import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { LoginForm } from "@/features/auth/components/login-form";
import { I18nProvider } from "@/lib/i18n/provider";
import { authService } from "@/services/auth.service";
import type { AuthResponse } from "@/types/auth";

const { replaceMock, searchParamsState } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  searchParamsState: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => searchParamsState.value,
}));

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>{children}</I18nProvider>
    </QueryClientProvider>
  );
  return render(<LoginForm />, { wrapper });
}

describe("LoginForm", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    searchParamsState.value = new URLSearchParams();
  });

  it("renders accessible fields with associated labels", () => {
    renderForm();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("shows validation errors for empty submission (no network call)", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findAllByRole("alert")).toBeTruthy();
    expect(screen.getAllByText("This field is required.").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a readable error for an invalid email format", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "securePass1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
  });

  it("signs in and redirects a verified onboarded student to /app", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Email"), "layla.hassan@example.com");
    await user.type(screen.getByLabelText("Password"), "securePass1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"));
  });

  it("routes a guardian to the guardian area after login", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Email"), "guardian@example.com");
    await user.type(screen.getByLabelText("Password"), "securePass1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/guardian"));
  });

  it("honors the ?next= intended destination after login", async () => {
    searchParamsState.value = new URLSearchParams({ next: "/app/recall" });
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Email"), "layla.hassan@example.com");
    await user.type(screen.getByLabelText("Password"), "securePass1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app/recall"));
  });

  it("routes an unverified account to verification instead of the app", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Email"), "pending@example.com");
    await user.type(screen.getByLabelText("Password"), "securePass1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/verify-email"));
  });

  it("shows the normalized invalid-credentials error, not a raw backend message", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Email"), "wrong@example.com");
    await user.type(screen.getByLabelText("Password"), "securePass1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("The email or password is incorrect.")).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("shows the network error message when the request fails at transport level", async () => {
    vi.spyOn(authService, "login").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Email"), "layla.hassan@example.com");
    await user.type(screen.getByLabelText("Password"), "securePass1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("We couldn't connect to Mureeh. Check your connection and try again."),
    ).toBeTruthy();
  });

  it("enters a loading state while authenticating (button disabled)", async () => {
    // Never-resolving promise: the pending state is asserted, then the
    // component unmounts at teardown — no post-test state updates.
    vi.spyOn(authService, "login").mockReturnValueOnce(
      new Promise<AuthResponse>(() => {
        /* intentionally never settles */
      }),
    );
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Email"), "layla.hassan@example.com");
    await user.type(screen.getByLabelText("Password"), "securePass1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /loading/i })).toBeTruthy(),
    );
    expect((screen.getByRole("button", { name: /loading/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("toggles password visibility accessibly", async () => {
    const user = userEvent.setup();
    renderForm();
    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");

    const toggle = screen.getByRole("button", { name: "Show password" });
    await user.click(toggle);
    expect(password.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.type).toBe("password");
  });

  it("shows the session-expired notice when arriving with ?expired=1", () => {
    searchParamsState.value = new URLSearchParams({ expired: "1" });
    renderForm();
    expect(
      screen.getByText("Your session expired. Please sign in again."),
    ).toBeTruthy();
  });
});
