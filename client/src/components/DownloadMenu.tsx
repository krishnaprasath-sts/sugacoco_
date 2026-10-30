import { useState } from 'react';
import { Button, ListItemIcon, ListItemText, Menu, MenuItem, type SxProps } from '@mui/material';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import TableViewOutlined from '@mui/icons-material/TableViewOutlined';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';

const FORMATS = [
  { key: 'xlsx', label: 'Excel (.xlsx)', icon: <TableViewOutlined fontSize="small" sx={{ color: '#15803D' }} /> },
  { key: 'pdf', label: 'PDF', icon: <PictureAsPdfOutlined fontSize="small" sx={{ color: '#DC2626' }} /> },
  { key: 'csv', label: 'CSV', icon: <DescriptionOutlined fontSize="small" /> },
] as const;

/** "Download" button with Excel / PDF / CSV. `href` is the report URL without the format, e.g. /api/reports/orders?from=... */
export default function DownloadMenu({ href, fullWidth, sx }: { href: string; fullWidth?: boolean; sx?: SxProps }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const sep = href.includes('?') ? '&' : '?';
  return (
    <>
      <Button
        variant="contained"
        fullWidth={fullWidth}
        startIcon={<FileDownloadOutlined />}
        endIcon={<KeyboardArrowDownRounded />}
        onClick={(e) => {
          e.currentTarget.blur();
          setAnchor(e.currentTarget);
        }}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        sx={{ minHeight: 40, ...sx }}
      >
        Download
      </Button>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 180 } } }}
      >
        {FORMATS.map((f) => (
          <MenuItem key={f.key} component="a" href={`${href}${sep}format=${f.key}`} onClick={() => setAnchor(null)}>
            <ListItemIcon>{f.icon}</ListItemIcon>
            <ListItemText>{f.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
