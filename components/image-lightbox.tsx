"use client";

import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";

interface ImageLightboxProps {
  images: string[];
  open: boolean;
  onClose: () => void;
  startIndex?: number;
}

export function ImageLightbox({
  images,
  open,
  onClose,
  startIndex = 0,
}: ImageLightboxProps) {
  if (images.length === 0) return null;

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={startIndex}
      slides={images.map((src) => ({ src }))}
      plugins={[Counter]}
      counter={{ container: { style: { top: "unset", bottom: 0 } } }}
      carousel={{ finite: images.length <= 1 }}
      controller={{ closeOnBackdropClick: true }}
    />
  );
}
