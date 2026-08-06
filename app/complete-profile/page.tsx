import { completeProfile } from "@/app/actions/completeProfile";
import AuthHeader from "@/app/components/auth/AuthHeader";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function CompleteProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const provider = await db.provider.findUnique({
    where: { id: session.providerId },
    select: { firstName: true, lastName: true, role: true },
  });

  if (!provider) {
    redirect("/login");
  }

  if (provider.role) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-shell">
      <AuthHeader />
      <div className="auth-page">
        <section className="auth-card auth-card-login">
          <div className="auth-form-wrap">
            <div className="auth-heading">
              <h2>Complete Profile</h2>
            </div>

            <form action={completeProfile} className="auth-form">
              <div className="auth-field">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  name="firstName"
                  defaultValue={provider.firstName}
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  name="lastName"
                  defaultValue={provider.lastName}
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="role">Provider Role</label>
                <MaterialSelect
                  id="role"
                  name="role"
                  required
                  style={{ width: "100%" }}
                  options={[
                    { value: "", label: "Select" },
                    { value: "Supervisor", label: "Supervisor" },
                    { value: "SpeechPathologist", label: "Speech Pathologist" },
                    { value: "BehaviorTherapist", label: "Behavior Therapist" },
                    { value: "OccupationalTherapist", label: "Occupational Therapist" },
                    { value: "Caregiver", label: "Caretaker" },
                    { value: "Educator", label: "Educator" },
                  ]}
                />
              </div>

              <button type="submit" className="auth-button">
                Continue
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
