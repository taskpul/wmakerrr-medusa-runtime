import FileModuleService from "../file-module-service"

const createService = () => {
  const provider = {
    upload: jest.fn(async ({ filename }) => ({ key: filename, url: filename })),
    delete: jest.fn(async () => undefined),
  }
  const service = new FileModuleService(
    { fileProviderService: provider as any },
    { store_isolation: { mode: "shared" } }
  )

  return { provider, service }
}

describe("File service Store isolation", function () {
  it("fails closed without Store context", async function () {
    const { service } = createService()

    await expect(
      service.createFiles({
        filename: "invoice.pdf",
        mimeType: "application/pdf",
        content: "dGVzdA==",
      })
    ).rejects.toThrow("File operations in shared mode require Store context")
  })

  it("namespaces uploaded objects by Store", async function () {
    const { provider, service } = createService()

    await service.createFiles(
      {
        filename: "invoice.pdf",
        mimeType: "application/pdf",
        content: "dGVzdA==",
      },
      { storeId: "store_a" } as any
    )

    expect(provider.upload).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "stores/store_a/invoice.pdf" })
    )
  })

  it("rejects access to a foreign Store key", async function () {
    const { service } = createService()

    await expect(
      service.deleteFiles("stores/store_b/invoice.pdf", {
        storeId: "store_a",
      } as any)
    ).rejects.toThrow("File key belongs to another Store")
  })
})
