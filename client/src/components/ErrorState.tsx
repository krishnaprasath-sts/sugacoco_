import { Alert, Button } from '@mui/material';
import { formError } from '../lib/formErrors';

/** Shown instead of an empty state when data failed to load, so "no data" and "server down" never look the same. */
export default function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  return (
    <Alert
      severity="error"
      sx={compact ? undefined : { my: 1 }}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      Could not load this. {formError(error) ?? ''}
    </Alert>
  );
}
