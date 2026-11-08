jest.mock("../config", () => ({
  configManager: {
    config: {
      projectConfig: {
        databaseUrl: "postgres://user:pass@database.internal:5432/medusa",
        databaseDriverOptions: undefined,
        databaseLogging: false,
        databaseSchema: "public",
        databaseName: "medusa",
      },
    },
  },
}))

import { ContainerRegistrationKeys } from "@medusajs/utils"

import { configManager } from "../config"
import { MedusaAppLoader } from "../medusa-app-loader"

class TestMedusaAppLoader extends MedusaAppLoader {
  getSharedResources() {
    return this.prepareSharedResourcesAndDeps()
  }
}

const createLoader = (ssl: boolean) =>
  new TestMedusaAppLoader({
    container: {
      resolve: jest.fn((key) => {
        if (key === ContainerRegistrationKeys.PG_CONNECTION) {
          return {
            client: {
              config: {
                connection: {
                  connectionString:
                    "postgres://user:pass@database.internal:5432/medusa",
                  ssl,
                },
              },
            },
          }
        }

        return { info: jest.fn() }
      }),
    } as any,
  })

describe("MedusaAppLoader database resources", () => {
  afterEach(() => {
    configManager.config.projectConfig.databaseDriverOptions = undefined
  })

  it("preserves the primary connection SSL policy for migration connections", () => {
    const { sharedResourcesConfig } = createLoader(false).getSharedResources()

    expect(sharedResourcesConfig.database?.driverOptions).toEqual({
      connection: { ssl: false },
    })
  })

  it("prefers explicitly configured database driver options", () => {
    const configured = {
      connection: { ssl: { rejectUnauthorized: true } },
    }
    configManager.config.projectConfig.databaseDriverOptions = configured

    const { sharedResourcesConfig } = createLoader(false).getSharedResources()

    expect(sharedResourcesConfig.database?.driverOptions).toEqual(configured)
  })
})
