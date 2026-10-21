import { scrubMessage } from '../monitoring';

jest.mock('@sentry/react-native', () => ({}));

describe('informes de errores', () => {
  it('quita los parámetros de las consultas fallidas', () => {
    const message =
      'Failed query: update "notes" set "title" = ? where "id" = ?\nparams: Lista de la compra,0192';
    expect(scrubMessage(message)).toBe(
      'Failed query: update "notes" set "title" = ? where "id" = ?\nparams: [redacted]',
    );
  });

  it('deja intactos los mensajes sin parámetros', () => {
    expect(scrubMessage('Network request failed')).toBe('Network request failed');
  });
});
