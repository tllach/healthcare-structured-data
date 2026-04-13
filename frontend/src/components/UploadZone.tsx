"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { clsx } from "clsx";
import { Check, File as FileIcon, FileUp } from "lucide-react";
import { Button } from "@/components/ui";

const MAX_BYTES = 10 * 1024 * 1024;

const ACCEPT = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/tiff": [".tiff", ".tif"],
  "image/webp": [".webp"],
} as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function rejectionMessage(rejected: FileRejection[]): "size" | "type" {
  const codes = rejected.flatMap((r) => r.errors.map((e) => e.code));
  if (codes.includes("file-too-large")) return "size";
  return "type";
}

export interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFileSelect, disabled = false }: UploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [zoneError, setZoneError] = useState<"size" | "type" | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (disabled) return;
      if (rejectedFiles.length > 0) {
        setSelectedFile(null);
        setZoneError(rejectionMessage(rejectedFiles));
        return;
      }
      if (acceptedFiles.length > 0) {
        setZoneError(null);
        setSelectedFile(acceptedFiles[0]);
      }
    },
    [disabled]
  );

  const dropzone = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_BYTES,
    maxFiles: 1,
    multiple: false,
    disabled,
    noClick: selectedFile !== null && zoneError === null,
    noKeyboard: disabled,
  });

  const { getRootProps, getInputProps, isDragActive, open } = dropzone;

  const showIdle =
    selectedFile === null && zoneError === null;
  const showFileReady =
    selectedFile !== null && zoneError === null;
  const showZoneError = zoneError !== null;

  return (
    <div className="relative w-full">
      <div
        {...getRootProps()}
        className={clsx(
          "rounded-2xl border-2 border-dashed p-12 transition-transform duration-200",
          disabled && "pointer-events-none opacity-60",
          showZoneError && "border-red-400 bg-red-50",
          !showZoneError &&
            isDragActive &&
            showIdle &&
            "scale-[1.01] border-blue-400 bg-blue-50",
          !showZoneError &&
            !(isDragActive && showIdle) &&
            (showIdle || showFileReady) &&
            "border-gray-300 bg-white",
          showIdle && !disabled && "cursor-pointer"
        )}
      >
        <input {...getInputProps()} />

        {showIdle && !isDragActive && (
          <div className="flex flex-col items-center text-center">
            <FileUp className="mb-4 h-12 w-12 text-blue-400" aria-hidden />
            <p className="text-lg font-medium text-gray-700">
              Drop your clinical document here
            </p>
            <p className="mt-1 text-sm text-blue-600 underline">
              or click to browse
            </p>
            <p className="mt-6 text-xs text-gray-400">
              Accepted: PDF, PNG, JPG, TIFF · Max 10MB
            </p>
          </div>
        )}

        {showIdle && isDragActive && (
          <div className="flex flex-col items-center text-center">
            <FileUp className="mb-4 h-12 w-12 text-blue-400" aria-hidden />
            <p className="text-lg font-medium text-gray-700">
              Release to upload
            </p>
            <p className="mt-6 text-xs text-gray-400">
              Accepted: PDF, PNG, JPG, TIFF · Max 10MB
            </p>
          </div>
        )}

        {showFileReady && selectedFile && (
          <div className="mx-auto flex max-w-md flex-col items-stretch gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
              <FileIcon
                className="mt-0.5 h-8 w-8 shrink-0 text-gray-500"
                aria-hidden
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium text-gray-900">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Check
                className="h-6 w-6 shrink-0 text-green-600"
                aria-label="File ready"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={() => onFileSelect(selectedFile)}
            >
              Extract Data
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-center"
              onClick={() => setSelectedFile(null)}
            >
              Choose different file
            </Button>
          </div>
        )}

        {showZoneError && (
          <div className="flex flex-col items-center text-center">
            <p className="text-lg font-medium text-red-800">
              {zoneError === "size"
                ? "File too large (max 10MB)"
                : "File type not supported"}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="mt-4 text-sm font-medium text-blue-600 underline"
              onClick={() => setZoneError(null)}
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
