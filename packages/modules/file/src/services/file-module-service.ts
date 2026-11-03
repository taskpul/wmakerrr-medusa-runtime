import {
  Context,
  CreateFileDTO,
  FileDTO,
  FileTypes,
  FilterableFileProps,
  FindConfig,
  GetUploadFileUrlDTO,
  ModuleJoinerConfig,
  UploadFileUrlDTO,
} from "@medusajs/framework/types"
import type { Readable, Writable } from "stream"

import { getActiveMedusaContext, MedusaError } from "@medusajs/framework/utils"
import { joinerConfig } from "../joiner-config"
import FileProviderService from "./file-provider-service"

type InjectedDependencies = {
  fileProviderService: FileProviderService
}

export default class FileModuleService implements FileTypes.IFileModuleService {
  protected readonly fileProviderService_: FileProviderService
  protected readonly storeIsolation_: {
    mode: "dedicated" | "shared"
    storeId: string
  }
  constructor(
    { fileProviderService }: InjectedDependencies,
    moduleDeclaration: any = {}
  ) {
    this.fileProviderService_ = fileProviderService
    const options = moduleDeclaration.options ?? moduleDeclaration
    this.storeIsolation_ = {
      mode: options.store_isolation?.mode ?? "dedicated",
      storeId: options.store_isolation?.store_id ?? "__medusa_dedicated__",
    }
  }

  protected resolveStoreId_(context?: Context): string | undefined {
    const requested =
      (context as Context & { storeId?: string })?.storeId?.trim() ??
      getActiveMedusaContext()?.storeId?.trim()
    if (this.storeIsolation_.mode === "shared") {
      if (!requested) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "File operations in shared mode require Store context"
        )
      }
      return requested
    }
    if (requested && requested !== this.storeIsolation_.storeId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "File context does not match the dedicated Store"
      )
    }
    return undefined
  }

  protected scopeFileKey_(key: string, context?: Context): string {
    const storeId = this.resolveStoreId_(context)
    if (!storeId) {
      return key
    }
    const prefix = `stores/${storeId}/`
    if (key.startsWith("stores/") && !key.startsWith(prefix)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "File key belongs to another Store"
      )
    }
    return key.startsWith(prefix) ? key : `${prefix}${key}`
  }

  __joinerConfig(): ModuleJoinerConfig {
    return joinerConfig
  }

  getProvider() {
    return this.fileProviderService_
  }

  createFiles(
    data: CreateFileDTO[],
    sharedContext?: Context
  ): Promise<FileDTO[]>
  createFiles(data: CreateFileDTO, sharedContext?: Context): Promise<FileDTO>

  async createFiles(
    data: CreateFileDTO[] | CreateFileDTO,
    sharedContext?: Context
  ): Promise<FileDTO[] | FileDTO> {
    const input = Array.isArray(data) ? data : [data]
    // TODO: Validate file mime type, have config for allowed types

    const files = await Promise.all(
      input.map((file) =>
        this.fileProviderService_.upload({
          ...file,
          filename: this.scopeFileKey_(file.filename, sharedContext),
        })
      )
    )
    const result = files.map((file) => ({
      id: file.key,
      url: file.url,
    }))

    return Array.isArray(data) ? result : result[0]
  }

  getUploadFileUrls(
    data: GetUploadFileUrlDTO[],
    sharedContext?: Context
  ): Promise<UploadFileUrlDTO[]>
  getUploadFileUrls(
    data: GetUploadFileUrlDTO,
    sharedContext?: Context
  ): Promise<UploadFileUrlDTO>

  async getUploadFileUrls(
    data: GetUploadFileUrlDTO[] | GetUploadFileUrlDTO,
    sharedContext?: Context
  ): Promise<UploadFileUrlDTO[] | UploadFileUrlDTO> {
    const input = Array.isArray(data) ? data : [data]

    const result = await Promise.all(
      input.map((file) =>
        this.fileProviderService_.getPresignedUploadUrl({
          ...file,
          filename: this.scopeFileKey_(file.filename, sharedContext),
        })
      )
    )

    return Array.isArray(data) ? result : result[0]
  }

  async deleteFiles(ids: string[], sharedContext?: Context): Promise<void>
  async deleteFiles(id: string, sharedContext?: Context): Promise<void>
  async deleteFiles(
    ids: string[] | string,
    sharedContext?: Context
  ): Promise<void> {
    const input = Array.isArray(ids) ? ids : [ids]
    await this.fileProviderService_.delete(
      input.map((id) => {
        return { fileKey: this.scopeFileKey_(id, sharedContext) }
      })
    )
  }

  async retrieveFile(id: string): Promise<FileDTO> {
    id = this.scopeFileKey_(id)
    const res = await this.fileProviderService_.getPresignedDownloadUrl({
      fileKey: id,
    })

    return {
      id,
      url: res,
    }
  }

  async listFiles(
    filters?: FilterableFileProps,
    config?: FindConfig<FileDTO>,
    sharedContext?: Context
  ): Promise<FileDTO[]> {
    if (!filters?.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Listing of files is only supported when filtering by ID."
      )
    }

    const ids = (Array.isArray(filters?.id) ? filters?.id : [filters?.id]).map(
      (id) => this.scopeFileKey_(id, sharedContext)
    )

    const res = await Promise.all(
      ids.map(async (id) => {
        const res = await this.fileProviderService_.getPresignedDownloadUrl({
          fileKey: id,
        })
        return { id, url: res }
      })
    )

    return res
  }

  async listAndCountFiles(
    filters?: FilterableFileProps,
    config?: FindConfig<FileDTO>,
    sharedContext?: Context
  ): Promise<[FileDTO[], number]> {
    if (!filters?.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Listing of files is only supported when filtering by ID."
      )
    }

    const ids = (Array.isArray(filters?.id) ? filters?.id : [filters?.id]).map(
      (id) => this.scopeFileKey_(id, sharedContext)
    )

    const res = await Promise.all(
      ids.map(async (id) => {
        const res = await this.fileProviderService_.getPresignedDownloadUrl({
          fileKey: id,
        })
        return { id, url: res }
      })
    )

    return [res, res.length]
  }

  /**
   * Get the file contents as a readable stream.
   *
   * @example
   * const stream = await fileModuleService.getAsStream("file_123")
   * writeable.pipe(stream)
   */
  getDownloadStream(id: string): Promise<Readable> {
    return this.fileProviderService_.getDownloadStream({
      fileKey: this.scopeFileKey_(id),
    })
  }

  /**
   * Get the file contents as a Node.js Buffer
   *
   * @example
   * const contents = await fileModuleService.getAsBuffer("file_123")
   * contents.toString('utf-8')
   */
  getAsBuffer(id: string): Promise<Buffer> {
    return this.fileProviderService_.getAsBuffer({
      fileKey: this.scopeFileKey_(id),
    })
  }

  /**
   * Get a writeable stream to upload a file.
   *
   * @example
   * const { writeStream, promise } = await fileModuleService.getUploadStream({
   *   filename: "test.csv",
   *   mimeType: "text/csv",
   * })
   *
   * stream.pipe(writeStream)
   * const result = await promise
   */
  getUploadStream(data: FileTypes.ProviderUploadStreamDTO): Promise<{
    writeStream: Writable
    promise: Promise<FileTypes.ProviderFileResultDTO>
    url: string
    fileKey: string
  }> {
    return this.fileProviderService_.getUploadStream({
      ...data,
      filename: this.scopeFileKey_(data.filename),
    })
  }
}
