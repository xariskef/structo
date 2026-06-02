import { Input } from "@structo/ui/components/input";
import { Label } from "@structo/ui/components/label";
import { Textarea } from "@structo/ui/components/textarea";

interface SeoFieldsProps {
  idPrefix: string;
  title: string;
  description: string;
  disabled?: boolean;
  titlePlaceholder?: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function SeoFields({
  idPrefix,
  title,
  description,
  disabled = false,
  titlePlaceholder,
  onTitleChange,
  onDescriptionChange,
}: SeoFieldsProps) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-title`} className="flex justify-between">
          <span>Meta title</span>
          <span className="font-normal text-muted-foreground">
            {title.length}/70
          </span>
        </Label>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          maxLength={70}
          disabled={disabled}
          onChange={(event) => onTitleChange(event.currentTarget.value)}
          placeholder={titlePlaceholder}
        />
      </div>
      <div className="grid gap-1.5">
        <Label
          htmlFor={`${idPrefix}-description`}
          className="flex justify-between"
        >
          <span>Meta description</span>
          <span className="font-normal text-muted-foreground">
            {description.length}/160
          </span>
        </Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={description}
          maxLength={160}
          rows={3}
          disabled={disabled}
          onChange={(event) => onDescriptionChange(event.currentTarget.value)}
        />
      </div>
    </div>
  );
}
