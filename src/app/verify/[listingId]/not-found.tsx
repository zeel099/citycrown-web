import Link from "next/link";

export default function VerifyNotFound() {
  return (
    <div className="inner verify">
      <h1 className="h1 verify-title">Business not found</h1>
      <p className="lead verify-lead">This business isn&apos;t on a board, so it can&apos;t be verified. Find it on its board and try again.</p>
      <p className="verify-lead">
        <Link className="btn btn-secondary btn-sm" href="/">
          See the boards
        </Link>
      </p>
    </div>
  );
}
