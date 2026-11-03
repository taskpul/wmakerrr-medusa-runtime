import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { track } from "@medusajs/telemetry"
import express from "express"
import loaders from "../loaders"

export default async function ({
  directory,
  id,
  email,
  password,
  keepAlive,
  invite,
}) {
  track("CLI_USER", { with_id: !!id })
  const app = express()
  try {
    process.env.MEDUSA_WORKER_MODE = "server"

    const { container } = await loaders({
      directory,
      expressApp: app,
      skipLoadingEntryPoints: true,
    })
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

    const authService = container.resolve(Modules.AUTH)
    const workflowService = container.resolve(Modules.WORKFLOW_ENGINE)

    const provider = "emailpass"

    if (invite) {
      const { result: invites } = await workflowService.run(
        "create-invite-step",
        {
          input: {
            invites: [
              {
                email,
              },
            ],
          },
        }
      )

      const createdInvite = invites[0]

      logger.info(
        `
      Invite token: ${createdInvite.token}
      Open the invite in Medusa Admin at: [your-admin-url]/invite?token=${createdInvite.token}`
      )
    } else {
      const { result: users } = await workflowService.run(
        "create-users-workflow",
        {
          input: {
            users: [
              {
                email,
              },
            ],
          },
        }
      )

      const user = users[0]

      const { authIdentity, error } = await authService.register(provider, {
        body: {
          email,
          password,
        },
      })

      if (error) {
        logger.error(error)
        process.exit(1)
      }

      await authService.updateAuthIdentities({
        id: authIdentity!.id,
        app_metadata: {
          user_id: user.id,
        },
      })

      logger.info("User created successfully.")
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }

  track("CLI_USER_COMPLETED", { with_id: !!id })

  if (!keepAlive) {
    process.exit()
  }
}
