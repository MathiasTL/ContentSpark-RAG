import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Field from "./Field";
import PasswordField from "./PasswordField";

const icon = <svg aria-hidden="true" data-testid="icon" />;

describe("Field", () => {
  it("ata la etiqueta al input, de modo que el clic enfoca el campo", () => {
    render(<Field id="email" label="Correo" icon={icon} />);

    const input = screen.getByLabelText("Correo");
    expect(input).toHaveAttribute("id", "email");
  });

  it("muestra el hint y lo referencia con aria-describedby", () => {
    render(<Field id="pw" label="Clave" icon={icon} hint="Mínimo 6 caracteres." />);

    const input = screen.getByLabelText("Clave");
    const message = screen.getByText("Mínimo 6 caracteres.");
    expect(input).toHaveAttribute("aria-describedby", message.id);
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  // El hint y el error comparten lugar: el requisito se declara antes de
  // enviar y, si falla, ese mismo párrafo cambia de tono.
  it("reemplaza el hint por el error y marca el campo como invalido", () => {
    render(
      <Field
        id="pw"
        label="Clave"
        icon={icon}
        hint="Mínimo 6 caracteres."
        error="Muy corta."
      />,
    );

    expect(screen.queryByText("Mínimo 6 caracteres.")).not.toBeInTheDocument();
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Muy corta.");
    expect(screen.getByLabelText("Clave")).toHaveAttribute("aria-invalid", "true");
  });

  it("no emite aria-describedby cuando no hay mensaje", () => {
    render(<Field id="x" label="X" icon={icon} />);
    expect(screen.getByLabelText("X")).not.toHaveAttribute("aria-describedby");
  });

  it("renderiza el enlace auxiliar en la fila de la etiqueta", () => {
    render(
      <Field
        id="pw"
        label="Clave"
        icon={icon}
        labelTrailing={<a href="/x">Olvidé mi clave</a>}
      />,
    );

    expect(screen.getByRole("link", { name: "Olvidé mi clave" })).toBeInTheDocument();
    expect(screen.getByLabelText("Clave")).toBeInTheDocument();
  });
});

describe("PasswordField", () => {
  const setup = (props: Partial<React.ComponentProps<typeof PasswordField>> = {}) => {
    const onToggle = vi.fn();
    render(
      <PasswordField
        id="pw"
        label="Contraseña"
        value=""
        onChange={vi.fn()}
        visible={false}
        onToggleVisibility={onToggle}
        autoComplete="current-password"
        {...props}
      />,
    );
    return { onToggle };
  };

  it("oculta el valor por defecto y lo revela cuando visible es true", () => {
    const { rerender } = render(
      <PasswordField
        id="pw"
        label="Contraseña"
        value="secreta"
        onChange={vi.fn()}
        visible={false}
        onToggleVisibility={vi.fn()}
        autoComplete="current-password"
      />,
    );
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");

    rerender(
      <PasswordField
        id="pw"
        label="Contraseña"
        value="secreta"
        onChange={vi.fn()}
        visible
        onToggleVisibility={vi.fn()}
        autoComplete="current-password"
      />,
    );
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "text");
  });

  it("da al ojo un nombre accesible que refleja la accion", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Mostrar contraseña" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("cambia el nombre accesible cuando la contrasena esta visible", () => {
    setup({ visible: true });
    expect(
      screen.getByRole("button", { name: "Ocultar contraseña" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("avisa al padre en vez de manejar la visibilidad por su cuenta", () => {
    const { onToggle } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // ResetPassword usa un solo ojo para dos campos: el segundo sigue el estado
  // pero no dibuja su propio boton.
  it("omite el ojo cuando no recibe onToggleVisibility", () => {
    render(
      <PasswordField
        id="confirm"
        label="Confirmar"
        value=""
        onChange={vi.fn()}
        visible
        autoComplete="new-password"
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar")).toHaveAttribute("type", "text");
  });
});
