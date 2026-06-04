// SPDX-License-Identifier: MIT
import React from 'react';
import { IconVideo, IconX } from '@tabler/icons-react';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-[#76b900] focus:outline-none focus:ring-1 focus:ring-[#76b900] dark:border-gray-600 dark:bg-[#343541] dark:text-gray-300';
const POPUP_OVERLAY_CLASS = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
const POPUP_CONTAINER_CLASS = 'mx-4 w-full max-w-xl rounded-lg bg-white p-6 shadow-xl dark:bg-[#343541]';

interface AgentUploadFileItem {
  id: string;
  file: File;
  isExpanded: boolean;
  formData: Record<string, any>;
}

interface AgentUploadDialogProps {
  open: boolean;
  files: AgentUploadFileItem[];
  configTemplate: any;
  onAddMore: () => void;
  onClose: () => void;
  onConfirmUpload: () => void;
  onToggleExpand: (fileId: string) => void;
  onRemoveFile: (fileId: string) => void;
  onFieldChange: (fileId: string, fieldName: string, value: any) => void;
}

export const AgentUploadDialog: React.FC<AgentUploadDialogProps> = ({
  open,
  files,
  configTemplate,
  onAddMore,
  onClose,
  onConfirmUpload,
  onRemoveFile,
}) => {
  if (!open) return null;

  return (
    <div className={POPUP_OVERLAY_CLASS}>
      <div className={POPUP_CONTAINER_CLASS}>
        <h3 className="mb-6 text-center text-lg font-semibold text-gray-900 dark:text-white">
          Upload Files
        </h3>

        {/* Files list */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Files <span className="text-red-500">*</span>
              {files.length > 0 && (
                <span className="ml-2 rounded-full bg-[#76b900] px-2 py-0.5 text-xs text-white">
                  {files.length}
                </span>
              )}
            </label>
            {files.length > 0 && (
              <button
                onClick={onAddMore}
                className="flex items-center gap-1 rounded-lg bg-[#76b900] px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-[#5a8f00]"
              >
                + Add More
              </button>
            )}
          </div> 

          {files.length > 0 ? (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {files.map((item) => {
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600"
                  >
                    <div className="flex items-center justify-between bg-white p-3 dark:bg-[#343541]">
                      <div className="flex flex-1 items-center gap-2 overflow-hidden">
                        <IconVideo size={18} className="flex-shrink-0 text-[#76b900]" />
                        <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                          {item.file.name}
                        </span>
                        <span className="flex-shrink-0 text-xs text-gray-400">
                          ({(item.file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <button
                        onClick={() => onRemoveFile(item.id)}
                        className="ml-2 flex-shrink-0 text-gray-500 hover:text-red-500"
                        aria-label="Remove file"
                      >
                        <IconX size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              onClick={onAddMore}
              className="w-full cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors border-gray-300 hover:border-[#76b900] hover:bg-gray-50 dark:border-gray-600 dark:hover:border-[#76b900] dark:hover:bg-gray-800"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Click or drag files here
              </span>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Movie Files (mp4, mkv)</div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmUpload}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              files.length > 0 ? 'bg-[#76b900] hover:bg-[#5a8f00]' : 'bg-gray-400 cursor-not-allowed'
            }`}
            disabled={files.length === 0}
          >
            Upload {files.length > 0 ? `(${files.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
