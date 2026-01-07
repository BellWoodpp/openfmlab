import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./button";

const BrowserNotSupported = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-overlayShow z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-background p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none z-[51] data-[state=open]:animate-contentShow">
          <Dialog.Title className="text-foreground m-0 text-[17px] font-medium mb-4">
            Browser Not Supported
          </Dialog.Title>
          <Dialog.Description className="text-foreground/70 mt-[10px] mb-5 text-[15px] leading-normal">
            Your browser does not support the features required for this demo.
            Please use a modern browser like Chrome, Edge, or Firefox.
          </Dialog.Description>
          <div className="mt-[25px] flex justify-end">
            <Button color="primary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default BrowserNotSupported;