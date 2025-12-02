import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PolicyField, policyFieldsConfig } from "@/types/policyFields";
import { useState, useEffect } from "react";

interface DynamicPolicyFieldsProps {
  policyType: string;
  onFieldsChange?: (fields: Record<string, any>) => void;
}

export const DynamicPolicyFields = ({ policyType, onFieldsChange }: DynamicPolicyFieldsProps) => {
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const fields = policyFieldsConfig[policyType] || [];

  // Initialize default values
  useEffect(() => {
    const defaults: Record<string, any> = {};
    fields.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.name] = field.defaultValue;
      }
    });
    setFieldValues(defaults);
  }, [policyType]);

  // Notify parent component of field changes
  useEffect(() => {
    if (onFieldsChange) {
      onFieldsChange(fieldValues);
    }
  }, [fieldValues, onFieldsChange]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  if (fields.length === 0) {
    return null;
  }

  const renderField = (field: PolicyField) => {
    const commonProps = {
      id: field.name,
      name: field.name,
      required: field.required,
      placeholder: field.placeholder,
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              {...commonProps}
              type={field.type}
              value={fieldValues[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              pattern={field.validation?.pattern}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              {...commonProps}
              type="number"
              value={fieldValues[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              min={field.validation?.min}
              max={field.validation?.max}
              step="0.01"
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              {...commonProps}
              type="date"
              value={fieldValues[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select
              name={field.name}
              required={field.required}
              value={fieldValues[field.name] || ''}
              onValueChange={(value) => handleFieldChange(field.name, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder || `Seleziona ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              {...commonProps}
              value={fieldValues[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              rows={4}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
            />
            {field.description && (
              <p className="text-xs text-muted-foreground">{field.description}</p>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.name} className="flex items-center space-x-2 py-2">
            <Checkbox
              id={field.name}
              name={field.name}
              checked={fieldValues[field.name] || false}
              onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
            />
            <Label
              htmlFor={field.name}
              className="text-sm font-normal cursor-pointer"
            >
              {field.label}
            </Label>
            {field.description && (
              <p className="text-xs text-muted-foreground ml-6">{field.description}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="border-t pt-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-primary">
          Campi Specifici per {policyType}
        </h3>
        <p className="text-sm text-muted-foreground">
          Compila i campi specifici per questa tipologia di polizza
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        {fields.map(field => renderField(field))}
      </div>
    </div>
  );
};
