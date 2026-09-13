import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Session, SessionState } from "@/types/auth";

const { replaceMock, authState, pathnameState } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  authState: {
    value: {
      status: "loading",
      session: null,
      user: null,
      isSessionExpired: false,
      isLoading: true,
      isAuthenticated: false,
    } as unknown,
  },
  pathnameState: { value: "/app/roadmap" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  usePathname: () => pathnameState.value,
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => authState.value,
}));

function makeUser(overrides: Partial<Session["user"]> = {}): Session["user"] {
  return {
    id: "u1",
    name: "Test Student",
    email: "test@example.com",
    role: "student",
    emailVerification: "verified",
    onboarding: "completed",
    ...overrides,
  };
}

function setState(state: Partial<SessionState> & { expired?: boolean }) {
  const session = state.session ?? null;
  authState.value = {
    status: state.status ?? "unauthenticated",
    session,
    user: session?.user ?? null,
    isSessionExpired: state.expired ?? false,
    isLoading: state.status === "loading",
    isAuthenticated: state.status === "authenticated",
  };
}

function renderGuard(children: ReactNode = <div>protected content</div>, allowRoles?: ("student" | "guardian")[]) {
  return render(
    <I18nProvider>
      <RequireAuth allowRoles={allowRoles}>{children}</RequireAuth>
    </I18nProvider>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pathnameState.value = "/app/roadmap";
    setState({ status: "loading" });
  });

  it("shows a calm loading state while the session resolves", () => {
    renderGuard();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Checking your session…")).toBeTruthy();
    expect(screen.queryByText("protected content")).toBeNull();
  });

  it("redirects unauthenticated users to login preserving the intended destination", async () => {
    setState({ status: "unauthenticated" });
    renderGuard();
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/sign-in?next=%2Fapp%2Froadmap"),
    );
    expect(screen.queryByText("protected content")).toBeNull();
  });

  it("flags session expiry on the login redirect", async () => {
    setState({ status: "unauthenticated", expired: true });
    renderGuard();
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/sign-in?next=%2Fapp%2Froadmap&expired=1"),
    );
  });

  it("renders children for an authorized authenticated student", async () => {
    setState({
      status: "authenticated",
      session: { user: makeUser(), issuedAt: "", expiresAt: "" },
    });
    renderGuard(<div>protected content</div>, ["student"]);
    await waitFor(() => expect(screen.getByText("protected content")).toBeTruthy());
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects an unverified user to the verification screen with next preserved", async () => {
    setState({
      status: "authenticated",
      session: {
        user: makeUser({ emailVerification: "unverified" }),
        issuedAt: "",
        expiresAt: "",
      },
    });
    renderGuard();
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith("/verify-email?next=%2Fapp%2Froadmap"),
    );
    expect(screen.queryByText("protected content")).toBeNull();
  });

  it("routes a guardian out of the student area without a redirect loop", async () => {
    setState({
      status: "authenticated",
      session: { user: makeUser({ role: "guardian" }), issuedAt: "", expiresAt: "" },
    });
    renderGuard(<div>protected content</div>, ["student"]);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/guardian"));
    // The unauthorized notice is shown while the redirect is in flight.
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("routes a student out of the guardian area to the student home", async () => {
    setState({
      status: "authenticated",
      session: { user: makeUser({ role: "student" }), issuedAt: "", expiresAt: "" },
    });
    renderGuard(<div>guardian content</div>, ["guardian"]);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/app"));
  });

  it("applies no role restriction when allowRoles is omitted", async () => {
    setState({
      status: "authenticated",
      session: { user: makeUser({ role: "guardian" }), issuedAt: "", expiresAt: "" },
    });
    renderGuard(<div>shared content</div>);
    await waitFor(() => expect(screen.getByText("shared content")).toBeTruthy());
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
