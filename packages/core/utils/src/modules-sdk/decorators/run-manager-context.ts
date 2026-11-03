import { Context } from "@medusajs/types"

export type ManagerContextTask<T> = (context: Context) => Promise<T>

type ManagerContextService = {
  withManagerContext_?: <T>(
    context: Context,
    task: ManagerContextTask<T>
  ) => Promise<T>
}

export async function runManagerContext<T>(
  service: ManagerContextService,
  context: Context,
  task: ManagerContextTask<T>
): Promise<T> {
  if (typeof service.withManagerContext_ !== "function") {
    return await task(context)
  }

  return await service.withManagerContext_(context, task)
}
