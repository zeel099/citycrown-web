import Link from "next/link";

export default function NotFound() {
  return (
    <div className="inner not-found">
      <h1 className="h2">This board isn&apos;t open yet</h1>
      <p className="lead">Boards open city by city. Pick one that&apos;s live, or add a business to help open the next one.</p>
      <p>
        <Link className="btn btn-primary" href="/#cities">
          See open boards
        </Link>
      </p>
    </div>
  );
}
