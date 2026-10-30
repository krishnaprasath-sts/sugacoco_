import { useState } from 'react';
import { Autocomplete, Box, Button, Stack, TextField, Typography } from '@mui/material';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import { useCustomers, type Customer } from '../../api/customers';
import { useDebounced } from '../../lib/useDebounced';
import CustomerFormDialog from './CustomerFormDialog';

type Props = {
  value: Customer | null;
  onChange: (c: Customer | null) => void;
  error?: string;
  disabled?: boolean;
};

/** Search existing customers; add a new one without leaving the order form. */
export default function CustomerPicker({ value, onChange, error, disabled }: Props) {
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  // When the box just shows the picked customer's name, search everything so the
  // list still offers other customers to switch to.
  const q = useDebounced(value && input === value.companyName ? '' : input);
  const { data, isFetching } = useCustomers({ q, pageSize: 20 });
  const options = data?.customers ?? [];

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'flex-start' } }}>
        <Autocomplete
          sx={{ flex: 1 }}
          value={value}
          onChange={(_, v) => onChange(v)}
          inputValue={input}
          onInputChange={(_, v) => setInput(v)}
          options={value && !options.some((o) => o.id === value.id) ? [value, ...options] : options}
          getOptionLabel={(o) => o.companyName}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterOptions={(x) => x}
          loading={isFetching}
          disabled={disabled}
          noOptionsText={input ? 'No customer found. Use "New customer" to add them.' : 'Type to search customers'}
          renderOption={(props, o) => {
            const { key, ...rest } = props as typeof props & { key: string };
            return (
              <Box component="li" key={key} {...rest}>
                <Box>
                  <Typography sx={{ fontWeight: 500 }}>{o.companyName}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {[o.contactPerson, o.country].filter(Boolean).join(' · ') || '—'}
                  </Typography>
                </Box>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Customer"
              required
              placeholder="Type to search customers"
              error={!!error}
              helperText={error ?? 'Search by company name, contact, email or country'}
            />
          )}
        />
        <Button
          variant="outlined"
          startIcon={<PersonAddAlt1Outlined />}
          onClick={() => setAdding(true)}
          disabled={disabled}
          sx={{ minHeight: 40, whiteSpace: 'nowrap', mt: { sm: '22px !important' } }}
        >
          New customer
        </Button>
      </Stack>
      {adding && (
        <CustomerFormDialog
          initialName={value ? '' : input}
          onClose={() => setAdding(false)}
          onSaved={(c) => {
            setAdding(false);
            onChange(c);
          }}
        />
      )}
    </>
  );
}
