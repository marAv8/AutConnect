import { completeProfile } from "@/app/actions/completeProfile";
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
                <select id="role" name="role" required>
                  <option value="">Select</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="SpeechPathologist">Speech Pathologist</option>
                  <option value="BehaviorTherapist">Behavior Therapist</option>
                  <option value="OccupationalTherapist">Occupational Therapist</option>
                  <option value="Caregiver">Caretaker</option>
                  <option value="Educator">Educator</option>
                </select>
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
