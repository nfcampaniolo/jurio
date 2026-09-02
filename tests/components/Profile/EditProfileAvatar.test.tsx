import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => ({
  FiCamera: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="icon-camera" {...props} />
  ),
}));

/* ---------- mock framer-motion con filtraggio props ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");

  const passthrough =
    (Tag: string) =>
    ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }) =>
      ReactActual.createElement(Tag, props, children);

  return {
    motion: {
      div: passthrough("div"),
    },
  };
});

/* ---------- component ---------- */
import { EditProfileAvatar } from "@/components/Profile/EditProfileAvatar"; // <-- adegua il path se necessario

describe("EditProfileAvatar Component Suite", () => {
  const mockSetAvatar = vi.fn<(url: string) => void>();
  const mockSetAvatarFile = vi.fn<(file: File) => void>();
  const mockCreateObjectURL = vi.fn<(blob: Blob | MediaSource) => string>();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateObjectURL.mockReturnValue("blob:http://localhost/avatar-preview-123");
    global.URL.createObjectURL = mockCreateObjectURL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (
    props: Partial<React.ComponentProps<typeof EditProfileAvatar>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof EditProfileAvatar> = {
      avatar: "https://jurio.it/assets/avatars/user.jpg",
      name: "Flavio Campaniolo",
      shouldReduceMotion: false,
      setAvatar: mockSetAvatar,
      setAvatarFile: mockSetAvatarFile,
      ...props,
    };

    return render(<EditProfileAvatar {...defaultProps} />);
  };

  test("renderizza l'immagine profilo quando l'URL avatar è fornito", () => {
    renderComponent({ avatar: "https://jurio.it/assets/avatars/user.jpg" });

    const avatarImg = screen.getByRole("img", { name: "Foto profilo" });
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute("src", "https://jurio.it/assets/avatars/user.jpg");
    expect(avatarImg).toHaveAttribute("loading", "lazy");
    expect(avatarImg).toHaveAttribute("decoding", "async");

    expect(screen.getByText("Clicca sull’avatar per cambiare immagine.")).toBeInTheDocument();
  });

  test("renderizza l'iniziale del nome in maiuscolo quando l'avatar è null", () => {
    renderComponent({ avatar: null, name: "laura neri" });

    expect(screen.queryByRole("img", { name: "Foto profilo" })).toBeNull();
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  test("renderizza il carattere '?' di fallback quando l'avatar è null e il nome è una stringa vuota", () => {
    renderComponent({ avatar: null, name: "" });

    expect(screen.queryByRole("img", { name: "Foto profilo" })).toBeNull();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  test("gestisce il caricamento di un nuovo file immagine aggiornando avatar e stato file", () => {
    const { container } = renderComponent();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute("accept", "image/*");

    const newFile = new File(["dummy-avatar-content"], "profile-pic.png", { type: "image/png" });

    fireEvent.change(fileInput, {
      target: { files: [newFile] },
    });

    expect(mockCreateObjectURL).toHaveBeenCalledWith(newFile);
    expect(mockSetAvatar).toHaveBeenCalledWith("blob:http://localhost/avatar-preview-123");
    expect(mockSetAvatarFile).toHaveBeenCalledWith(newFile);
  });

  test("non invoca le callback di aggiornamento se la selezione del file viene annullata (files vuoto)", () => {
    const { container } = renderComponent();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: { files: [] },
    });

    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(mockSetAvatar).not.toHaveBeenCalled();
    expect(mockSetAvatarFile).not.toHaveBeenCalled();
  });

  test("garantisce l'accessibilità della label e la presenza dell'icona fotocamera", () => {
    renderComponent();

    const changeAvatarLabel = screen.getByLabelText("Cambia immagine profilo");
    expect(changeAvatarLabel).toBeInTheDocument();
    expect(screen.getByTestId("icon-camera")).toBeInTheDocument();
  });

  test("supporta shouldReduceMotion impostato a true", () => {
    renderComponent({ shouldReduceMotion: true });

    expect(screen.getByRole("img", { name: "Foto profilo" })).toBeInTheDocument();
  });
});