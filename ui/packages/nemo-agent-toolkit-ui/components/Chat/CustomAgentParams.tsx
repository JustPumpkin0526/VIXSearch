import { useCallback, useEffect, useRef, useState } from 'react';

import { getStorageKey } from '@/contexts/RuntimeConfigContext';

// Type definitions matching .env format
export type ParamType = 'string' | 'number' | 'boolean' | 'select';

export interface ParamFieldConfig {
  name: string;
  label: string;
  type: ParamType;
  'default-value': string | number | boolean;
  options?: string[];
  changeable?: boolean; // default: true - if false, user cannot change value on UI
  'tooltip-info'?: string;
}

export interface ParamField extends ParamFieldConfig {
  id: string;
  value: string | number | boolean;
}

export type CustomAgentParamsValue = string | number | boolean | string[];
export type CustomAgentParamsValues = Record<string, CustomAgentParamsValue>;
export const CUSTOM_AGENT_PARAMS_STORAGE_KEY = 'customAgentParamsValues';
export const CUSTOM_AGENT_PARAMS_UPDATED_EVENT = 'custom-agent-params-updated';

interface CustomAgentParamsProps {
  isOpen: boolean;
  onClose: () => void;
  fields: ParamField[];
  onFieldsChange: (fields: ParamField[]) => void;
  anchorRef?: React.RefObject<HTMLElement>;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

// Reusable input styles
const inputClass = "w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#76b900]";

const normalizeNumberInput = (value: string): number => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getCustomAgentParamsStorageKey = (storageKeyPrefix?: string | null): string =>
  getStorageKey(CUSTOM_AGENT_PARAMS_STORAGE_KEY, storageKeyPrefix);

export const applySavedValuesToFields = (
  fields: ParamField[],
  savedValues: CustomAgentParamsValues,
): ParamField[] =>
  fields.map((field) => {
    if (!field.name || !(field.name in savedValues)) return field;

    const savedValue = savedValues[field.name];
    const isValidType =
      (field.type === 'boolean' && typeof savedValue === 'boolean') ||
      (field.type === 'number' && typeof savedValue === 'number' && !isNaN(savedValue)) ||
      ((field.type === 'string' || field.type === 'select') && typeof savedValue === 'string');

    return isValidType ? { ...field, value: savedValue } : field;
  });

export const buildInitialParamFields = (
  customAgentParamsJson?: string,
  storageKeyPrefix?: string | null,
): ParamField[] => {
  const parsedFields = parseParamsJson(customAgentParamsJson);
  const savedValues = loadParamValuesFromStorage(storageKeyPrefix);
  return applySavedValuesToFields(parsedFields, savedValues);
};

interface CustomAgentParamsFieldsProps {
  fields: ParamField[];
  onFieldsChange: (fields: ParamField[]) => void;
}

export const CustomAgentParamsFields: React.FC<CustomAgentParamsFieldsProps> = ({
  fields,
  onFieldsChange,
}) => {
  const handleFieldChange = useCallback((id: string, value: string | number | boolean) => {
    onFieldsChange(fields.map((field) => (field.id === id ? { ...field, value } : field)));
  }, [fields, onFieldsChange]);

  const renderValueInput = useCallback((field: ParamField) => {
    const isChangeable = field.changeable !== false;
    const disabledClass = !isChangeable ? 'opacity-60 cursor-not-allowed' : '';

    switch (field.type) {
      case 'boolean':
        return (
          <button
            type="button"
            title={field['tooltip-info']}
            disabled={!isChangeable}
            onClick={() => isChangeable && handleFieldChange(field.id, !field.value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              field.value ? 'bg-[#76b900]' : 'bg-gray-300 dark:bg-gray-600'
            } ${disabledClass}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                field.value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        );
      case 'select':
        return (
          <select
            title={field['tooltip-info']}
            disabled={!isChangeable}
            value={field.value as string}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={`${inputClass} ${disabledClass}`}
          >
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      case 'number':
        return (
          <input
            type="number"
            title={field['tooltip-info']}
            disabled={!isChangeable}
            step="1"
            value={field.value as number}
            onChange={(e) => handleFieldChange(field.id, normalizeNumberInput(e.target.value))}
            className={`${inputClass} ${disabledClass}`}
          />
        );
      default:
        return (
          <input
            type="text"
            title={field['tooltip-info']}
            disabled={!isChangeable}
            value={field.value as string}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className={`${inputClass} ${disabledClass}`}
          />
        );
    }
  }, [handleFieldChange]);

  if (fields.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No parameters configured.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
              title={field['tooltip-info']}
            >
              {field.label}
            </label>
            {field.type === 'boolean' && renderValueInput(field)}
          </div>
          {field['tooltip-info'] && (
            <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
              {field['tooltip-info']}
            </p>
          )}
          {field.type !== 'boolean' && <div>{renderValueInput(field)}</div>}
        </div>
      ))}
    </div>
  );
};

export const CustomAgentParams: React.FC<CustomAgentParamsProps> = ({
  isOpen,
  onClose,
  fields,
  onFieldsChange,
}) => {
  const backdropPressedRef = useRef(false);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    backdropPressedRef.current = event.target === event.currentTarget;
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const shouldClose = backdropPressedRef.current && event.target === event.currentTarget;
    backdropPressedRef.current = false;

    if (shouldClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Invisible backdrop to capture outside clicks */}
      <div 
        className="fixed inset-0 z-40" 
        onMouseDown={handleBackdropMouseDown}
        onClick={handleBackdropClick}
      />
      {/* Dialog */}
      <div className="absolute bottom-full right-0 mb-2 min-w-60 max-w-80 bg-white dark:bg-[#2d2d30] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
        {/* Form Content */}
        <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
          <CustomAgentParamsFields fields={fields} onFieldsChange={onFieldsChange} />
        </div>
      </div>
    </>
  );
};

// Helper function to convert fields to payload object
export const fieldsToParams = (fields: ParamField[]): CustomAgentParamsValues => 
  (fields || []).reduce((acc, field) => {
    if (field.name) {
      acc[field.name] = field.value;
    }
    return acc;
  }, {} as CustomAgentParamsValues);

// Parse JSON string to ParamField array
// Format: { "params": [{ "name": "...", "label": "...", "type": "...", "default-value": ... }] }
export const parseParamsJson = (jsonString?: string): ParamField[] => {
  try {
    if (!jsonString) return [];
    
    const parsed = JSON.parse(jsonString) as { params: ParamFieldConfig[] };
    if (!parsed.params || !Array.isArray(parsed.params)) return [];
    
    return parsed.params.map((item) => ({
      ...item,
      id: generateId(),
      value: item['default-value'],
    }));
  } catch (e) {
    console.error('Failed to parse customAgentParamsJson:', e);
    return [];
  }
};

// Storage key for persisting custom agent params values
/**
 * Load saved param values from sessionStorage
 */
export const loadParamValuesFromStorage = (storageKeyPrefix?: string | null): CustomAgentParamsValues => {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = sessionStorage.getItem(getCustomAgentParamsStorageKey(storageKeyPrefix));
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.warn('Failed to load custom agent params from sessionStorage:', error);
    return {};
  }
};

/**
 * Save param values to sessionStorage
 */
export const saveParamValuesToStorage = (
  fields: ParamField[],
  storageKeyPrefix?: string | null,
  options?: { broadcast?: boolean },
): void => {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.setItem(
      getCustomAgentParamsStorageKey(storageKeyPrefix),
      JSON.stringify(fieldsToParams(fields)),
    );

    if (options?.broadcast !== false) {
      window.dispatchEvent(
        new CustomEvent(CUSTOM_AGENT_PARAMS_UPDATED_EVENT, {
          detail: {
            storageKeyPrefix: storageKeyPrefix ?? null,
          },
        }),
      );
    }
  } catch (error) {
    console.warn('Failed to save custom agent params to sessionStorage:', error);
  }
};

// Hook to initialize param fields from JSON string (from context/state)
// Values are persisted to sessionStorage and restored on page refresh
export const useInitialParamFields = (
  customAgentParamsJson?: string,
  storageKeyPrefix?: string | null,
): [ParamField[], React.Dispatch<React.SetStateAction<ParamField[]>>] => {
  const [fields, setFields] = useState<ParamField[]>([]);
  const initialized = useRef(false);
  
  // Initialize fields from JSON and restore saved values from sessionStorage
  useEffect(() => {
    if (!initialized.current && customAgentParamsJson) {
      initialized.current = true;
      setFields(buildInitialParamFields(customAgentParamsJson, storageKeyPrefix));
    }
  }, [customAgentParamsJson, storageKeyPrefix]);

  useEffect(() => {
    if (!customAgentParamsJson || typeof window === 'undefined') {
      return undefined;
    }

    const handleParamsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ storageKeyPrefix?: string | null }>;
      const eventPrefix = customEvent.detail?.storageKeyPrefix ?? null;

      if ((storageKeyPrefix ?? null) !== eventPrefix) {
        return;
      }

      setFields(buildInitialParamFields(customAgentParamsJson, storageKeyPrefix));
    };

    window.addEventListener(CUSTOM_AGENT_PARAMS_UPDATED_EVENT, handleParamsUpdated as EventListener);

    return () => {
      window.removeEventListener(CUSTOM_AGENT_PARAMS_UPDATED_EVENT, handleParamsUpdated as EventListener);
    };
  }, [customAgentParamsJson, storageKeyPrefix]);
  
  // Save to sessionStorage whenever fields change (after initialization)
  useEffect(() => {
    if (initialized.current && fields.length > 0) {
      saveParamValuesToStorage(fields, storageKeyPrefix, { broadcast: false });
    }
  }, [fields, storageKeyPrefix]);
  
  return [fields, setFields];
};

// For backwards compatibility
export const defaultParamFields: ParamField[] = [];
