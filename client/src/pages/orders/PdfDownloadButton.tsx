import { useState } from 'react';
import { Button, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import RequestQuoteOutlined from '@mui/icons-material/RequestQuoteOutlined';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';

/** Download the order as a Proforma Invoice or Quotation PDF (made on the server from the order data). */
export default function PdfDownloadButton({ orderId }: { orderId: number }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const item = (type: 'pi' | 'quotation', label: string, hint: string, icon: React.ReactNode) => (
    <MenuItem component="a" href={`/api/orders/${orderId}/pdf/${type}`} download onClick={() => setAnchor(null)}>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={label} secondary={hint} />
    </MenuItem>
  );
  return (
    <>
      <Button
        variant="outlined"
        startIcon={<PictureAsPdfOutlined />}
        endIcon={<KeyboardArrowDown />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
      >
        Download PDF
      </Button>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {item('pi', 'Proforma Invoice (PI)', 'With advance and balance', <ReceiptLongOutlined fontSize="small" />)}
        {item('quotation', 'Quotation', 'Prices only, valid 15 days', <RequestQuoteOutlined fontSize="small" />)}
      </Menu>
    </>
  );
}
