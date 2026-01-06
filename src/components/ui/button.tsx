import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        tertiary: "bg-muted text-foreground hover:bg-muted/80",
        neutral:
          "bg-background text-foreground border border-border hover:bg-accent hover:text-accent-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
      block: {
        true: "w-full",
      },
      selected: {
        true: "ring-2 ring-ring/60 ring-offset-2 ring-offset-background",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonColor = "default" | "primary" | "secondary" | "tertiary" | "neutral";

type ButtonBaseProps = VariantProps<typeof buttonVariants> & {
  asChild?: boolean;
  block?: boolean;
  selected?: boolean;
  color?: ButtonColor;
  className?: string;
};

type ButtonAsButtonProps = ButtonBaseProps &
  React.ComponentPropsWithoutRef<"button"> & {
    href?: undefined;
  };

type ButtonAsAnchorProps = ButtonBaseProps &
  React.ComponentPropsWithoutRef<"a"> & {
    href: string;
  };

type ButtonProps = ButtonAsButtonProps | ButtonAsAnchorProps;

function Button(props: ButtonAsButtonProps): React.ReactElement;
function Button(props: ButtonAsAnchorProps): React.ReactElement;
function Button(props: ButtonProps) {
  const {
    className,
    variant,
    size,
    asChild = false,
    block,
    selected,
    color,
  } = props;

  const resolvedVariant =
    variant ?? (color as VariantProps<typeof buttonVariants>["variant"] | undefined);

  const classes = cn(
    buttonVariants({
      variant: resolvedVariant,
      size,
      block: block ? true : undefined,
      selected: selected ? true : undefined,
      className,
    }),
  );

  if (asChild) {
    const { asChild: _asChild, block: _block, selected: _selected, color: _color, ...rest } =
      props as ButtonProps;

    return (
      <Slot
        data-slot="button"
        data-selected={selected ? "true" : undefined}
        className={classes}
        {...rest}
      />
    );
  }

  if (typeof (props as ButtonAsAnchorProps).href === "string") {
    const anchorProps = props as ButtonAsAnchorProps;
    const { href, block: _block, selected: _selected, color: _color, ...rest } = anchorProps;
    return (
      <a
        data-slot="button"
        data-selected={selected ? "true" : undefined}
        className={classes}
        href={href}
        {...rest}
      />
    );
  }

  const buttonProps = props as ButtonAsButtonProps;
  const { block: _block, selected: _selected, color: _color, ...rest } = buttonProps;
  return (
    <button
      data-slot="button"
      data-selected={selected ? "true" : undefined}
      className={classes}
      {...rest}
    />
  );
}

export { Button, buttonVariants }

export const ButtonLED = () => {
  return <span className="block w-[7px] h-[7px] rounded-full bg-black/10" />;
};
