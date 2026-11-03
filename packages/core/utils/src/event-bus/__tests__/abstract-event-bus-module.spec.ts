import { EventBusTypes } from "@medusajs/types"
import { AbstractEventBusModuleService } from ".."
import { runWithMedusaContext } from "../../modules-sdk/decorators/context-parameter"

class MockEventBusModuleService extends AbstractEventBusModuleService {
  constructor(moduleOptions: Record<string, unknown> = {}) {
    super({}, moduleOptions, {} as any)
  }

  async emit<T>(
    data: EventBusTypes.Message<T> | EventBusTypes.Message<T>[],
    options: Record<string, unknown>
  ): Promise<void> {
    return Promise.resolve()
  }

  async releaseGroupedEvents(eventGroupId: string): Promise<void> {
    return Promise.resolve()
  }

  async clearGroupedEvents(eventGroupId: string): Promise<void> {
    return Promise.resolve()
  }

  public testWithCreatedAtMetadata(metadata?: EventBusTypes.EventMetadata) {
    return this.withCreatedAtMetadata(metadata)
  }

  public testWithPublishedAtMetadata(metadata?: EventBusTypes.EventMetadata) {
    return this.withPublishedAtMetadata(metadata)
  }

  public testParseEventMetadataDates(metadata?: EventBusTypes.EventMetadata) {
    return this.parseEventMetadataDates(metadata)
  }

  public testRunWithEventStoreContext<T>(
    event: EventBusTypes.Message<unknown>,
    task: () => T
  ) {
    return this.runWithEventStoreContext_(event, task)
  }
}

describe("AbstractEventBusModuleService", () => {
  it("should be able to subscribe to an event", () => {
    const eventBus = new MockEventBusModuleService()
    const subscriber = jest.fn()
    eventBus.subscribe("test", subscriber)
    expect(eventBus.eventToSubscribersMap.get("test")).toEqual([
      { id: (subscriber as any).subscriberId, subscriber },
    ])
  })

  it("should throw an error if a subscriber with the same id is already subscribed to an event", () => {
    const eventBus = new MockEventBusModuleService()
    const subscriber = jest.fn()
    const subscriberId = "test"
    eventBus.subscribe("test", subscriber, { subscriberId })
    expect(() =>
      eventBus.subscribe("test", subscriber, { subscriberId })
    ).toThrow()
  })

  it("should be able to unsubscribe from an event", () => {
    const eventBus = new MockEventBusModuleService()
    const subscriber = jest.fn()
    eventBus.subscribe("test", subscriber)
    eventBus.unsubscribe("test", subscriber)
    expect(eventBus.eventToSubscribersMap.get("test")).toEqual([])
  })

  describe("event metadata timestamps", () => {
    it("should add created_at to metadata", () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date("2026-06-20T10:00:00.000Z"))

      const eventBus = new MockEventBusModuleService()
      const metadata = eventBus.testWithCreatedAtMetadata({
        source: "test",
      })

      expect(metadata).toEqual({
        source: "test",
        created_at: new Date("2026-06-20T10:00:00.000Z"),
      })
      expect(metadata.published_at).toBeUndefined()

      jest.useRealTimers()
    })

    it("should add published_at to metadata", () => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date("2026-06-20T11:00:00.000Z"))

      const eventBus = new MockEventBusModuleService()
      const metadata = eventBus.testWithPublishedAtMetadata({
        created_at: new Date("2026-06-20T10:00:00.000Z"),
      })

      expect(metadata.created_at).toEqual(new Date("2026-06-20T10:00:00.000Z"))
      expect(metadata.published_at).toEqual(
        new Date("2026-06-20T11:00:00.000Z")
      )

      jest.useRealTimers()
    })

    it("should parse serialized metadata dates", () => {
      const eventBus = new MockEventBusModuleService()
      const metadata = eventBus.testParseEventMetadataDates({
        created_at: "2026-06-20T10:00:00.000Z" as unknown as Date,
        published_at: "2026-06-20T11:00:00.000Z" as unknown as Date,
      })

      expect(metadata?.created_at).toEqual(new Date("2026-06-20T10:00:00.000Z"))
      expect(metadata?.published_at).toEqual(
        new Date("2026-06-20T11:00:00.000Z")
      )
    })
  })

  describe("Store provenance", () => {
    it("fails closed when shared emission has no active Store", () => {
      const eventBus = new MockEventBusModuleService({
        store_isolation: { mode: "shared" },
      })

      expect(() => eventBus.testWithCreatedAtMetadata()).toThrow(
        "Shared event emission requires Store provenance"
      )
    })

    it("stamps and restores the active Store", () => {
      const eventBus = new MockEventBusModuleService({
        options: { store_isolation: { mode: "shared" } },
      })
      const metadata = runWithMedusaContext({ storeId: "store_a" }, () =>
        eventBus.testWithCreatedAtMetadata()
      )

      expect(metadata.store_id).toBe("store_a")
      expect(
        eventBus.testRunWithEventStoreContext(
          { name: "test", data: {}, metadata },
          () => eventBus.testWithCreatedAtMetadata().store_id
        )
      ).toBe("store_a")
    })

    it("rejects Store provenance that conflicts with dedicated placement", () => {
      const eventBus = new MockEventBusModuleService({
        store_isolation: { mode: "dedicated", store_id: "store_a" },
      })

      expect(() =>
        runWithMedusaContext({ storeId: "store_b" }, () =>
          eventBus.testWithCreatedAtMetadata()
        )
      ).toThrow("Event Store provenance does not match dedicated placement")
    })
  })
})
