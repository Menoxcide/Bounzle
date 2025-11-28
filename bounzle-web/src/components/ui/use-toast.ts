"use client"

import { toast as sonnerToast } from "sonner"

export function useToast() {
  return {
    toast: (props: {
      title?: string
      description?: string
      variant?: "default" | "destructive"
    }) => {
      if (props.variant === "destructive") {
        sonnerToast.error(props.title || "Error", {
          description: props.description,
        })
      } else {
        // Use base toast for default variant
        sonnerToast(props.title || "Notification", {
          description: props.description,
        })
      }
    },
  }
}

