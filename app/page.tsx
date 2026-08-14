import ChessBoard from "./components/ChessBoard";

export default function Home() {
  return (
    <main>
      <ChessBoard boardWidth={480} onMovePlayed={undefined} />
    </main>
  );
}