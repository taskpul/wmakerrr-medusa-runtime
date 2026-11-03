import { PencilSquare } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { useTranslation } from "react-i18next"

import {
  Action,
  ActionMenu,
} from "../../../../../components/common/action-menu"

export const CustomerActions = ({
  customer,
}: {
  customer: HttpTypes.AdminCustomer
}) => {
  const { t } = useTranslation()
  const actions: Action[] = [
    {
      icon: <PencilSquare />,
      label: t("actions.edit"),
      to: `/customers/${customer.id}/edit`,
    },
  ]

  return (
    <ActionMenu
      groups={[
        {
          actions,
        },
      ]}
    />
  )
}
