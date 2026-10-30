import { useRef } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import AttachFile from '@mui/icons-material/AttachFile';
import { ACCEPT_FILES, MAX_FILE_MB } from '../workflow/documents';

type Props = {
  label: string;
  hint?: string;
  files: File[];
  onChange: (files: File[]) => void;
  multiple?: boolean;
  /** Called with a message when a file is too large. */
  onError?: (message: string) => void;
};

/** Pick files to upload later. Shows chosen files as removable chips. */
export default function FilePicker({ label, hint, files, onChange, multiple = true, onError }: Props) {
  const input = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    const tooBig = picked.filter((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig.length) onError?.(`${tooBig.map((f) => f.name).join(', ')}: each file must be under ${MAX_FILE_MB} MB`);
    const ok = picked.filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024);
    onChange(multiple ? [...files, ...ok] : ok.slice(0, 1));
    if (input.current) input.current.value = '';
  }

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <Button variant="outlined" startIcon={<AttachFile />} onClick={() => input.current?.click()} sx={{ minHeight: 40 }}>
          {label}
        </Button>
        {hint && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {hint}
          </Typography>
        )}
      </Stack>
      <input ref={input} type="file" hidden multiple={multiple} accept={ACCEPT_FILES} onChange={(e) => add(e.target.files)} />
      {files.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
          {files.map((f, i) => (
            <Chip
              key={`${f.name}-${i}`}
              label={f.name}
              onDelete={() => onChange(files.filter((_, j) => j !== i))}
              sx={{ maxWidth: 280 }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
