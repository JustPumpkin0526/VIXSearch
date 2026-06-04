import { IconCheck, IconClipboard, IconDownload } from '@tabler/icons-react';
import { FC, memo, useState, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import {
  generateRandomString,
  programmingLanguages,
} from '@/utils/app/codeblock';
import { copyToClipboard as copyToClipboardUtil } from '@/utils/shared/clipboard';

interface Props {
  language: string;
  value: string;
  isStreaming?: boolean;
}

export const CodeBlock: FC<Props> = memo(({ language, value }) => {
  const { t } = useTranslation('markdown');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Ensure value is a valid JSON string
  if (language === 'json') {
    try {
      value = value.replaceAll("'", '"');
    } catch (error) {
      console.log(error);
    }
  }

  const formattedValue = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value; // Return the original value if parsing fails
    }
  }, [value]);

  const copyToClipboard = async (e: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const success = await copyToClipboardUtil(formattedValue);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const downloadAsFile = (e: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const fileExtension = programmingLanguages[language] || '.file';
    const suggestedFileName = `file-${generateRandomString(
      3,
      true,
    )}${fileExtension}`;

    if (!suggestedFileName) {
      return;
    }

    const blob = new Blob([formattedValue], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = suggestedFileName;
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="codeblock relative font-sans text-[16px] w-full">
      <div className="flex items-center justify-between py-1.5 px-4 bg-gray-800 text-white">
        <span className="text-xs lowercase">{language}</span>

        <div className="flex items-center gap-1">
          <button
            className="flex gap-1.5 items-center rounded bg-none p-1 text-xs text-white hover:bg-gray-700"
            onClick={(e) => copyToClipboard(e)}
          >
            {isCopied ? <IconCheck size={18} /> : <IconClipboard size={18} />}
            {isCopied ? t('Copied!') : t('Copy code')}
          </button>
          <button
            className="flex items-center rounded bg-none p-1 text-xs text-white hover:bg-gray-700"
            onClick={(e) => downloadAsFile(e)}
          >
            <IconDownload size={18} />
          </button>
        </div>
      </div>
      <div 
        className="overflow-hidden"
        style={{
          maxHeight: '50vh',
          overflowY: 'auto',
        }}
      >
        <pre
          style={{
            margin: 0,
            padding: '16px',
            background: '#1f2937',
            fontSize: '14px',
            lineHeight: '1.5',
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            color: '#abb2bf',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          {formattedValue}
        </pre>
      </div>
    </div>
  );
});
CodeBlock.displayName = 'CodeBlock';
