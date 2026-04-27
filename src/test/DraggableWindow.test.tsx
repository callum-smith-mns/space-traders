import { render, screen, fireEvent } from '@testing-library/react';
import DraggableWindow from '../components/DraggableWindow';

describe('DraggableWindow', () => {
  it('renders title and children', () => {
    render(
      <DraggableWindow title="Test Window">
        <div data-testid="child">Hello</div>
      </DraggableWindow>
    );
    expect(screen.getByText('Test Window')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <DraggableWindow title="Ship" icon="/icon.png">
        <div>Content</div>
      </DraggableWindow>
    );
    const img = document.querySelector('.dw-icon') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('/icon.png');
  });

  it('does not render icon when not provided', () => {
    render(
      <DraggableWindow title="Ship">
        <div>Content</div>
      </DraggableWindow>
    );
    expect(document.querySelector('.dw-icon')).not.toBeInTheDocument();
  });

  it('minimizes and restores when clicking the minimize button', () => {
    render(
      <DraggableWindow title="Test">
        <div data-testid="body">Body</div>
      </DraggableWindow>
    );

    // Initially body visible
    expect(screen.getByTestId('body')).toBeInTheDocument();
    expect(document.querySelector('.dw-resize')).toBeInTheDocument();

    // Click minimize button (—)
    fireEvent.click(screen.getByTitle('Minimize'));

    // Body and resize handle should be hidden
    expect(screen.queryByTestId('body')).not.toBeInTheDocument();
    expect(document.querySelector('.dw-resize')).not.toBeInTheDocument();
    expect(document.querySelector('.dw--minimized')).toBeInTheDocument();

    // Click restore button (◻)
    fireEvent.click(screen.getByTitle('Restore'));

    // Body should be visible again
    expect(screen.getByTestId('body')).toBeInTheDocument();
    expect(document.querySelector('.dw-resize')).toBeInTheDocument();
  });

  it('applies default position and size', () => {
    render(
      <DraggableWindow title="Pos" defaultX={50} defaultY={60} defaultWidth={300} defaultHeight={400}>
        <div>C</div>
      </DraggableWindow>
    );
    const el = document.querySelector('.dw') as HTMLElement;
    expect(el.style.left).toBe('50px');
    expect(el.style.top).toBe('60px');
    expect(el.style.width).toBe('300px');
    expect(el.style.height).toBe('400px');
  });

  it('applies zIndex', () => {
    render(
      <DraggableWindow title="Z" zIndex={25}>
        <div>C</div>
      </DraggableWindow>
    );
    const el = document.querySelector('.dw') as HTMLElement;
    expect(el.style.zIndex).toBe('25');
  });

  it('calls onFocus when window is clicked', () => {
    const onFocus = vi.fn();
    render(
      <DraggableWindow title="Focus" onFocus={onFocus}>
        <div>C</div>
      </DraggableWindow>
    );
    fireEvent.mouseDown(document.querySelector('.dw')!);
    expect(onFocus).toHaveBeenCalled();
  });

  it('starts drag on title bar mousedown', () => {
    const onLayoutChange = vi.fn();
    render(
      <DraggableWindow title="Drag" defaultX={100} defaultY={100} onLayoutChange={onLayoutChange}>
        <div>C</div>
      </DraggableWindow>
    );

    const bar = document.querySelector('.dw-bar')!;
    fireEvent.mouseDown(bar, { clientX: 110, clientY: 110 });

    // Simulate drag
    fireEvent.mouseMove(window, { clientX: 150, clientY: 150 });
    fireEvent.mouseUp(window);

    expect(onLayoutChange).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
    );
  });

  it('starts resize on handle mousedown', () => {
    const onLayoutChange = vi.fn();
    render(
      <DraggableWindow title="Resize" defaultWidth={400} defaultHeight={500} onLayoutChange={onLayoutChange}>
        <div>C</div>
      </DraggableWindow>
    );

    const handle = document.querySelector('.dw-resize')!;
    fireEvent.mouseDown(handle, { clientX: 500, clientY: 600 });

    // Simulate resize
    fireEvent.mouseMove(window, { clientX: 550, clientY: 650 });
    fireEvent.mouseUp(window);

    expect(onLayoutChange).toHaveBeenCalledWith(
      expect.objectContaining({ w: expect.any(Number), h: expect.any(Number) })
    );
  });
});
