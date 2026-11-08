<p align="center">
  <a href="https://www.medusajs.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    </picture>
  </a>
</p>
<h1 align="center">
  @medusajs/api-key
</h1>

<h4 align="center">
  <a href="https://docs.medusajs.com">Documentation</a> |
  <a href="https://www.medusajs.com">Website</a>
</h4>

<p align="center">
  Building blocks for digital commerce
</p>
<p align="center">
  <a href="https://github.com/medusajs/medusa/blob/develop/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Medusa is released under the MIT license." />
  </a>
  <a href="https://github.com/medusajs/medusa/blob/develop/CONTRIBUTING.md">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat" alt="PRs welcome!" />
  </a>
  <a href="https://discord.gg/xpCwq3Kfn8">
    <img src="https://img.shields.io/badge/chat-on%20discord-7289DA.svg" alt="Discord Chat" />
  </a>
  <a href="https://twitter.com/intent/follow?screen_name=medusajs">
    <img src="https://img.shields.io/twitter/follow/medusajs.svg?label=Follow%20@medusajs" alt="Follow @medusajs" />
  </a>
</p>

API Key Module for Medusa: manages publishable and secret API keys, including creating, revoking, and authenticating them. Publishable keys scope storefront requests (for example, to sales channels), and secret keys authenticate admin API requests. It ships with `@medusajs/medusa` and is registered by default, so you normally use it through the Medusa application rather than installing it directly.

## At a glance

|                       |                                 |
| --------------------- | ------------------------------- |
| Package               | `@medusajs/api-key`             |
| Type                  | Commerce Module                 |
| Module key            | `Modules.API_KEY` (`"api_key"`) |
| Registered by default | Yes                             |
| Import from           | `@medusajs/medusa/api-key`      |

## Features

- Create `publishable` and `secret` API keys.
- Revoke keys and authenticate requests with a key's token.
- Isolate key management and authentication by Store when the module runs in
  shared mode.
- Idempotently provision a deterministic Store-scoped secret through the
  trusted runtime-bootstrap boundary.

## Installation

No installation needed. The module ships with `@medusajs/medusa` and is registered by default.

## Usage

Resolve the module's service from the container, for example in a workflow step:

```ts
import { Modules } from "@medusajs/framework/utils"

const apiKeyModuleService = container.resolve(Modules.API_KEY)
```

## Shared Store isolation

Configure `store_isolation.mode` as `"shared"` only in the controlled shared
runtime. Every management and authentication call must then include the active
`storeId` in its Medusa context; missing Store context fails closed. Keys from
one Store cannot be listed, retrieved, authenticated, updated, or deleted from
another Store context.

`provisionSecretApiKey` is reserved for trusted control-plane bootstrap code.
It accepts a deterministic 256-bit hexadecimal secret, serializes concurrent
provisioning for the same Store token and purpose, and returns the existing key
on an identical replay. Do not expose this method from an untrusted HTTP route
or return its raw token after bootstrap.

## Resources

- [API Key Module](https://docs.medusajs.com/resources/commerce-modules/api-key)
- [API Key concepts](https://docs.medusajs.com/resources/commerce-modules/api-key/concepts)
- [Commerce Modules](https://docs.medusajs.com/learn/fundamentals/modules/commerce-modules)
