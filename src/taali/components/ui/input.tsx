import { cn } from "@/taali/lib/utils";
import * as React from "react"


interface InputProps extends React.ComponentProps<"input"> {
  innerClassName?: string;
  startSlot?: React.ReactNode;
  endSlot?: React.ReactNode;
}

function Input({ className, type, startSlot, endSlot, innerClassName, ...props }: InputProps) {
  return (
    <div className={cn("relative flex items-center w-full", className)}>
      {startSlot && (
        <div className="absolute left-3 flex items-center pointer-events-none">
          {startSlot}
        </div>
      )}
      <input
        type={type}
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-background py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          startSlot && "pl-9",
          endSlot && "pr-9",
          !startSlot && !endSlot && "px-3",
          innerClassName
        )}
        {...props}
      />
      {endSlot && (
        <div className="absolute right-3 flex items-center pointer-events-none">
          {endSlot}
        </div>
      )}
    </div>
  )
}

export { Input }
