/* =========================================================
   screens/Welcome.jsx — React port of the welcome screen
   ========================================================= */
export default function Welcome({ onCreate }) {
  return (
    <section className="screen">
      <div className="welcome-card paper texture">
        <div className="welcome-mark" aria-hidden="true">&#128214;</div>
        <h1>Welcome to Your Diary</h1>
        <p className="welcome-tag">A private place for your thoughts, memories and everyday moments.</p>
        <p className="privacy-note">Your diary is stored locally on this device.</p>
        <button className="btn btn-primary btn-lg" type="button" autoFocus onClick={onCreate}>
          Create My Diary
        </button>
      </div>
    </section>
  );
}
