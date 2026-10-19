import { render, screen } from '@testing-library/react-native';

import { EmptyState } from '../empty-state';

describe('EmptyState', () => {
  it('muestra título y descripción', async () => {
    await render(<EmptyState icon="note" title="Sin notas" description="Crea la primera" />);
    expect(screen.getByText('Sin notas')).toBeTruthy();
    expect(screen.getByText('Crea la primera')).toBeTruthy();
  });
});
