import { Box } from '@mui/material';
import logoSrc from '../assets/sugacoco-logo.png';

/** Sugacoco brand logo. The image has its own dark background, so it shows as a rounded badge.
 *  Pass `width` to size by width, otherwise `height` is used. Never stretches to fill its parent. */
export default function Logo({ height = 44, width }: { height?: number; width?: number; light?: boolean }) {
  return (
    <Box
      component="img"
      src={logoSrc}
      alt="Sugacoco - Global Exporter since 1989"
      sx={{
        width: width ?? 'auto',
        height: width ? 'auto' : height,
        maxWidth: '100%',
        alignSelf: 'flex-start',
        display: 'block',
        borderRadius: '8px',
      }}
    />
  );
}
