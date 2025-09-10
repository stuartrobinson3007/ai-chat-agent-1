import React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/taali/lib/utils';
import { Button } from './button';
import { Calendar } from './calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from './popover';

interface DatePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function DatePicker({ date, setDate, placeholder = 'Pick a date', className, disabled }: DatePickerProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={'outline'}
                    className={cn(
                        'flex justify-start text-left font-normal',
                        !date && 'text-muted-foreground',
                        className
                    )}
                    disabled={disabled}
                >
                    <CalendarIcon className="h-4 w-4" />
                    <span className="ml-2">{date ? format(date, 'PPP') : placeholder}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(selectedDate) => {
                        setDate(selectedDate);
                        setOpen(false);
                    }}
                    initialFocus
                    disabled={disabled}
                />
            </PopoverContent>
        </Popover>
    );
}