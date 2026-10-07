import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import DostavkaApishipService from "./service"

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [DostavkaApishipService as any],
})
