import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ArtPreview } from './ArtPreview';

// Entrada de desenvolvimento: aperta-art.html não entra no build (só index.html é entrada de produção).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ArtPreview />
  </StrictMode>,
);
