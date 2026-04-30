import { completeProfile } from "@/app/actions/completeProfile";
import { authOptions } from "@/lib/nextAuth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function CompleteProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  return (
    <main className="auth-shell">
      <div className="auth-page">
        <header className="auth-header">
          <div className="auth-logo">AC</div>
        </header>

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
                  defaultValue={session.user.name?.split(" ")[0] ?? ""}
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  name="lastName"
                  defaultValue={session.user.name?.split(" ").slice(1).join(" ") ?? ""}
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
