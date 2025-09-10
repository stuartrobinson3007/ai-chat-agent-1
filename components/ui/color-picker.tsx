import { useState, useRef, useEffect, forwardRef } from "react";
import { HexColorPicker } from "react-colorful";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Input } from "./input";
import { cn } from "@/taali/lib/utils";

// Default preset colors
const defaultPresetColors = [
    "#ff0000", // Red
    "#ff8000", // Orange
    "#ffff00", // Yellow
    "#80ff00", // Lime
    "#00ff00", // Green
    "#00ff80", // Mint
    "#00ffff", // Cyan
    "#0080ff", // Sky Blue
    "#0000ff", // Blue
    "#8000ff", // Purple
    "#ff00ff", // Magenta
    "#ff0080", // Pink
    "#000000", // Black
    "#808080", // Gray
    "#ffffff", // White
];

/**
 * Validates if a string is a valid hex color (3 or 6 digits with optional # prefix)
 */
const isValidHex = (color: string) => {
    return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
};

/**
 * Checks if a string could potentially become a valid hex color
 */
const isPotentialHex = (input: string) => {
    return /^#?[0-9A-Fa-f]{0,6}$/.test(input);
};

/**
 * Formats a hex color to ensure it has # prefix and converts 3-digit to 6-digit format
 */
const formatHexColor = (color: string) => {
    // Ensure color has # prefix
    if (!color.startsWith("#")) {
        color = `#${color}`;
    }

    // Convert 3-digit hex to 6-digit
    if (color.length === 4) {
        const r = color[1];
        const g = color[2];
        const b = color[3];
        color = `#${r}${r}${g}${g}${b}${b}`;
    }

    return color;
};

/**
 * Checks if a color is a complete hex color (either #RGB or #RRGGBB)
 */
const isCompleteHex = (color: string) => {
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
};

interface ColorPickerProps {
    /** The current color value (with or without # prefix) */
    color?: string;
    /** Callback for when the color changes */
    onChange: (color: string) => void;
    /** Additional class names */
    className?: string;
    /** Whether the color picker is disabled */
    disabled?: boolean;
    /** Array of preset colors to display */
    presetColors?: string[];
    /** Placeholder text for the input */
    placeholder?: string;
    /** Whether to show the color presets */
    showPresets?: boolean;
    /** Whether to show the text input */
    showInput?: boolean;
    /** ID for the color picker */
    id?: string;
    /** Aria label for accessibility */
    "aria-label"?: string;
    /** Whether the color picker is in an error state */
    error?: boolean;
}

/**
 * A color picker component with hex input and color swatches
 */
export const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(
    ({
        color = "#000000",
        onChange,
        className,
        disabled = false,
        presetColors = defaultPresetColors,
        placeholder = "000000",
        showPresets = true,
        showInput = true,
        id,
        "aria-label": ariaLabel = "Color picker",
        error = false,
    }, ref) => {
        // State for popover
        const [open, setOpen] = useState(false);

        // Color state
        const [currentColor, setCurrentColor] = useState(formatHexColor(color));
        const [lastValidColor, setLastValidColor] = useState(formatHexColor(color));
        const [inputValue, setInputValue] = useState(formatHexColor(color).replace("#", ""));
        const [isInputValid, setIsInputValid] = useState(true);

        // UI state
        const [isFocused, setIsFocused] = useState(false);

        // Refs
        const inputRef = useRef<HTMLInputElement>(null);
        const triggerRef = useRef<HTMLButtonElement>(null);

        // Update internal state when color prop changes
        useEffect(() => {
            if (color) {
                const formattedColor = formatHexColor(color);
                setCurrentColor(formattedColor);
                setLastValidColor(formattedColor);
                setInputValue(formattedColor.replace("#", ""));
                setIsInputValid(true);
            }
        }, [color]);

        // Handle color picker change from the color picker component
        const handleColorChange = (newColor: string) => {
            if (isValidHex(newColor)) {
                const formattedColor = formatHexColor(newColor);
                setCurrentColor(formattedColor);
                setLastValidColor(formattedColor);
                setInputValue(formattedColor.replace("#", ""));
                setIsInputValid(true);
                onChange(formattedColor);
            }
        };

        // Handle hex input change from the text field
        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = e.target.value;

            // Always update the displayed input value for better UX
            setInputValue(value);

            // Check if the input is a potential hex value
            const isPotential = isPotentialHex(value);

            // Update valid state and color based on input value
            if (value === "" || isPotential) {
                // If it's a potential hex value, update the color state
                const newColor = value.startsWith("#") ? value : `#${value}`;
                setCurrentColor(newColor);

                // For complete valid hex values, update lastValidColor
                const isValidComplete = isValidHex(newColor) && isCompleteHex(newColor);
                setIsInputValid(isValidComplete);

                if (isValidComplete) {
                    const formattedColor = formatHexColor(newColor);
                    setLastValidColor(formattedColor);
                    onChange(formattedColor);
                }
            } else {
                // If it's not a potential hex, mark it as invalid but don't update color state
                setIsInputValid(false);
            }
        };

        // Handle input focus
        const handleFocus = () => {
            setIsFocused(true);
            // Remember the current valid color when focusing
            if (isValidHex(currentColor) && isCompleteHex(currentColor)) {
                setLastValidColor(formatHexColor(currentColor));
            }
        };

        // Handle input blur
        const handleBlur = () => {
            setIsFocused(false);

            // If input is not valid when blurring, reset to last valid color
            if (!isInputValid) {
                // Reset to the last valid color
                setCurrentColor(lastValidColor);
                setInputValue(lastValidColor.replace("#", ""));
                setIsInputValid(true);
                onChange(lastValidColor);
            } else {
                // Even if input is valid, ensure it's properly formatted
                const formattedColor = formatHexColor(currentColor);
                if (formattedColor !== currentColor) {
                    setCurrentColor(formattedColor);
                    setInputValue(formattedColor.replace("#", ""));
                    onChange(formattedColor);
                }
            }
        };

        // Handle keyboard accessibility
        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false);
            }
            // Handle Enter key to confirm the current value
            if (e.key === "Enter") {
                handleBlur();
            }
        };

        // Return focus to the trigger button when closing the popover
        useEffect(() => {
            if (!open && triggerRef.current) {
                setTimeout(() => {
                    triggerRef.current?.focus();
                }, 0);
            }
        }, [open]);

        // Check if current color is valid for display
        const displayColor = isFocused ? currentColor : (isValidHex(currentColor) ? currentColor : lastValidColor);

        return (
            <div
                ref={ref}
                className={cn("flex flex-col", className)}
                id={id}
                aria-label={ariaLabel}
                onKeyDown={handleKeyDown}
            >
                <div className="flex items-center gap-2">
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <button
                                ref={triggerRef}
                                type="button"
                                disabled={disabled}
                                className={cn(
                                    "h-8 w-8 rounded-md",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                                    error ? "border-2 border-red-500" : "border border-input",
                                    disabled && "opacity-50 cursor-not-allowed"
                                )}
                                style={{ backgroundColor: displayColor }}
                                aria-label={`Pick a color: ${displayColor}`}
                                aria-haspopup="dialog"
                                aria-expanded={open}
                            />
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-64 p-3"
                            sideOffset={5}
                            align="start"
                        >
                            <HexColorPicker
                                color={isValidHex(currentColor) ? currentColor : lastValidColor}
                                onChange={handleColorChange}
                                className="w-full"
                            />

                            {showPresets && presetColors.length > 0 && (
                                <div className="mt-3">
                                    <div className="grid grid-cols-8 gap-1">
                                        {presetColors.map((presetColor) => (
                                            <button
                                                key={presetColor}
                                                type="button"
                                                className={cn(
                                                    "aspect-square rounded-md border border-input",
                                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                                                    (isValidHex(currentColor) ? currentColor : lastValidColor).toLowerCase() === presetColor.toLowerCase() && "ring-2 ring-ring"
                                                )}
                                                style={{ backgroundColor: presetColor }}
                                                onClick={() => {
                                                    handleColorChange(presetColor);
                                                    setOpen(false);
                                                }}
                                                aria-label={`Select color: ${presetColor}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>

                    {showInput && (
                        <div className="flex items-center">
                            <Input
                                ref={inputRef}
                                value={inputValue}
                                onChange={handleInputChange}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                className={cn(
                                    "h-8 w-32 font-mono text-sm",
                                    error && "border-red-500 focus-visible:ring-red-500"
                                )}
                                placeholder={placeholder}
                                maxLength={6}
                                disabled={disabled}
                                aria-invalid={error}
                                startSlot={<span className="text-sm text-muted-foreground">#</span>}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }
);

ColorPicker.displayName = "ColorPicker";