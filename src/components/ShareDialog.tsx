import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { copyText } from "../lib/copyText";
import { useLocale } from "@/hooks";

const DialogDemo = ({
  shareUrl,
  open,
  onOpenChange,
}: {
  shareUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { locale } = useLocale();
  const copy =
    (
      {
        en: {
          title: "Share Link",
          description: "Copy the link below to share with others.",
          copy: "Copy",
          close: "Close",
        },
        zh: {
          title: "分享链接",
          description: "复制下面的链接与他人分享。",
          copy: "复制",
          close: "关闭",
        },
        ja: {
          title: "共有リンク",
          description: "下のリンクをコピーして共有できます。",
          copy: "コピー",
          close: "閉じる",
        },
        es: {
          title: "Enlace para compartir",
          description: "Copia el enlace de abajo para compartirlo.",
          copy: "Copiar",
          close: "Cerrar",
        },
        ar: {
          title: "رابط المشاركة",
          description: "انسخ الرابط أدناه لمشاركته.",
          copy: "نسخ",
          close: "إغلاق",
        },
        id: {
          title: "Tautan berbagi",
          description: "Salin tautan di bawah untuk dibagikan.",
          copy: "Salin",
          close: "Tutup",
        },
        pt: {
          title: "Link para compartilhar",
          description: "Copie o link abaixo para compartilhar.",
          copy: "Copiar",
          close: "Fechar",
        },
        fr: {
          title: "Lien de partage",
          description: "Copiez le lien ci-dessous pour le partager.",
          copy: "Copier",
          close: "Fermer",
        },
        ru: {
          title: "Ссылка для обмена",
          description: "Скопируйте ссылку ниже, чтобы поделиться.",
          copy: "Копировать",
          close: "Закрыть",
        },
        de: {
          title: "Link teilen",
          description: "Kopiere den Link unten, um ihn zu teilen.",
          copy: "Kopieren",
          close: "Schließen",
        },
      } as const
    )[locale] ??
    ({
      title: "Share Link",
      description: "Copy the link below to share with others.",
      copy: "Copy",
      close: "Close",
    } as const);

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 data-[state=open]:animate-overlayShow" />
        <Dialog.Content className="fixed bg-white left-1/2 top-1/2 max-h-[85vh] w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-md bg-gray1 p-[25px] shadow-[var(--shadow-6)] focus:outline-none data-[state=open]:animate-contentShow">
          <Dialog.Title className="m-0 text-[17px] font-medium text-mauve12">
            {copy.title}
          </Dialog.Title>
          <Dialog.Description className="mb-5 mt-2.5 text-[15px] leading-normal text-mauve11">
            {copy.description}
          </Dialog.Description>
          <fieldset className="mb-[15px] flex items-center gap-5">
            <input
              className="inline-flex h-[35px] w-full flex-1 items-center justify-center rounded px-2.5 text-[15px] leading-none text-violet11 shadow-[0_0_0_1px] shadow-violet7 outline-none focus:shadow-[0_0_0_2px] focus:shadow-violet8"
              id="name"
              defaultValue={shareUrl ?? ""}
            />
          </fieldset>
          <div className="mt-[25px] flex justify-end">
            <Dialog.Close asChild>
              <button
                className="cursor-pointer inline-flex h-[35px] items-center justify-center rounded bg-green4 px-[15px] font-medium leading-none text-green11 outline-none outline-offset-1 hover:bg-green5 focus-visible:outline-2 focus-visible:outline-green6 select-none"
                onClick={() => {
                  if (shareUrl) {
                    copyText(shareUrl);
                  }
                }}
              >
                {copy.copy}
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Close asChild>
            <button
              className="cursor-pointer absolute right-2.5 top-2.5 inline-flex size-[25px] appearance-none items-center justify-center rounded-full text-violet11 bg-gray3 hover:bg-violet4 focus:shadow-[0_0_0_2px] focus:shadow-violet7 focus:outline-none"
              aria-label={copy.close}
            >
              <Cross2Icon />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default DialogDemo;
