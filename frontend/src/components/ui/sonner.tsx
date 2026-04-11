import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/80 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl group-[.toaster]:px-6 group-[.toaster]:py-4",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:mt-1",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-full group-[.toast]:px-4 group-[.toast]:h-8 group-[.toast]:text-xs group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-full group-[.toast]:px-4 group-[.toast]:h-8 group-[.toast]:text-xs group-[.toast]:font-medium",
          success: "group-[.toaster]:text-emerald-500 group-[.toaster]:border-emerald-500/20",
          error: "group-[.toaster]:text-red-500 group-[.toaster]:border-red-500/20",
          info: "group-[.toaster]:text-blue-500 group-[.toaster]:border-blue-500/20",
          warning: "group-[.toaster]:text-amber-500 group-[.toaster]:border-amber-500/20",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
