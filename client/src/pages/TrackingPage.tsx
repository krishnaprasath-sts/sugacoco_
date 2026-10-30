/** Public, read-only order tracking page for customers (/track/:token). No login. */
import { useParams } from 'react-router';
import { Alert, Box, Card, CardContent, Chip, Divider, Skeleton, Stack, Typography } from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import Autorenew from '@mui/icons-material/Autorenew';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import { usePublicTracking } from '../api/stages';
import { formatDate, formatDateTime } from '../lib/format';
import { formError } from '../lib/formErrors';
import Logo from '../components/Logo';
import { SIDEBAR_GRADIENT } from '../theme';

export default function TrackingPage() {
  const token = useParams().token ?? '';
  const { data, isPending, error } = usePublicTracking(token);
  const o = data?.order;

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box sx={{ background: SIDEBAR_GRADIENT, color: '#fff', px: 2, pt: 3, pb: 10 }}>
        <Box sx={{ maxWidth: 720, mx: 'auto' }}>
          <Logo height={52} />
          <Typography variant="h5" component="h1" sx={{ mt: 3 }}>Order status</Typography>
          {o && <Typography sx={{ opacity: 0.85 }}>{o.customerName}</Typography>}
        </Box>
      </Box>

      <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, mt: -7, pb: 6 }}>
        {isPending && <Skeleton variant="rounded" height={360} />}
        {error && (
          <Card>
            <CardContent>
              <Alert severity="warning">{formError(error) ?? 'This tracking link is not valid or has expired.'}</Alert>
            </CardContent>
          </Card>
        )}
        {o && data && (
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Order / PI</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 20 }}>{o.orderNo}</Typography>
                    <Typography sx={{ color: 'text.secondary' }}>PI no: {o.piNumber} · {formatDate(o.piDate)}</Typography>
                  </Box>
                  <Chip
                    label={o.statusLabel}
                    color={o.cancelled ? 'default' : o.closed ? 'success' : 'primary'}
                    sx={{ fontWeight: 600, fontSize: 15, height: 36, px: 1 }}
                  />
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" spacing={4} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Last update</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{formatDateTime(o.lastUpdate)}</Typography>
                  </Box>
                  {o.expectedReadyDate && (
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Expected ready</Typography>
                      <Typography sx={{ fontWeight: 600 }}>{formatDate(o.expectedReadyDate)}</Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {o.cancelled ? (
              <Alert severity="warning">This order has been cancelled. Please contact us if you have questions.</Alert>
            ) : (
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>Progress</Typography>
                  <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                    {o.milestones.map((m, i) => (
                      <Box component="li" key={m.key} sx={{ display: 'flex', gap: 1.5, pb: i === o.milestones.length - 1 ? 0 : 2.5, position: 'relative' }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          {m.state === 'done' ? (
                            <CheckCircle color="success" />
                          ) : m.state === 'current' ? (
                            <Autorenew color="primary" />
                          ) : (
                            <RadioButtonUnchecked sx={{ color: 'text.disabled' }} />
                          )}
                          {i < o.milestones.length - 1 && <Box sx={{ width: 2, flex: 1, mt: 0.5, bgcolor: m.state === 'done' ? 'success.main' : 'divider' }} />}
                        </Box>
                        <Box sx={{ pt: 0.25 }}>
                          <Typography sx={{ fontWeight: m.state === 'upcoming' ? 400 : 600, color: m.state === 'upcoming' ? 'text.secondary' : 'text.primary' }}>{m.label}</Typography>
                          {m.state === 'current' && <Typography variant="body2" sx={{ color: 'primary.main' }}>{o.statusLabel}</Typography>}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Products</Typography>
                <Stack spacing={1}>
                  {o.products.map((p, i) => (
                    <Stack key={i} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                      <Typography>{p.name}</Typography>
                      <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{Number(p.quantity).toLocaleString()} {p.unit}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Questions about your order?</Typography>
                <Typography sx={{ color: 'text.secondary', mb: 1 }}>Contact {data.company.name}.</Typography>
                <Stack spacing={0.75}>
                  {data.company.supportEmail && (
                    <Typography component="a" href={`mailto:${data.company.supportEmail}`} sx={{ display: 'inline-flex', gap: 1, alignItems: 'center', color: 'primary.main' }}>
                      <EmailOutlined fontSize="small" /> {data.company.supportEmail}
                    </Typography>
                  )}
                  {data.company.supportPhone && (
                    <Typography component="a" href={`tel:${data.company.supportPhone.replace(/\s/g, '')}`} sx={{ display: 'inline-flex', gap: 1, alignItems: 'center', color: 'primary.main' }}>
                      <PhoneOutlined fontSize="small" /> {data.company.supportPhone}
                    </Typography>
                  )}
                  {!data.company.supportEmail && !data.company.supportPhone && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>Please reply to the message that shared this link.</Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
