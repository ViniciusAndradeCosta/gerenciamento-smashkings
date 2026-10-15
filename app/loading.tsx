/**
 * Aparece na hora em que você toca num link, enquanto o servidor monta a
 * próxima tela. Sem isso, o toque parecia não ter funcionado.
 */
export default function Carregando() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="ph">
        <div className="ph-in">
          <div className="ph-txt">
            <div className="esq" style={{ width: 150, height: 24 }} />
            <div className="esq" style={{ width: 210, height: 11, marginTop: 8 }} />
          </div>
        </div>
      </div>
      <div className="pg">
        <div className="resumo">
          <div><div className="esq" style={{ height: 44 }} /></div>
          <div><div className="esq" style={{ height: 44 }} /></div>
          <div><div className="esq" style={{ height: 44 }} /></div>
        </div>
        <div className="lista">
          {[0, 1, 2, 3, 4].map((i) => (
            <div className="item" key={i}>
              <div className="item-main">
                <div className="esq" style={{ width: '55%', height: 14 }} />
                <div className="esq" style={{ width: '35%', height: 10, marginTop: 8 }} />
              </div>
              <div className="esq" style={{ width: 60, height: 18 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
