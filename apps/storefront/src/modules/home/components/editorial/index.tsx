/**
 * Редакторский разворот между баннером и товарами — тот же приём, что
 * на референсе: одно высказывание, много воздуха, ничего лишнего.
 */
const Editorial = () => (
  <section className="border-b border-rule bg-mist">
    <div className="content-container flex flex-col items-center py-20 text-center small:py-28">
      <span className="label-type text-muted">Volento</span>
      <h2 className="mt-6 max-w-3xl font-display text-[2rem] leading-[1.15] text-ink small:text-[3rem]">
        Брюки, которые не нужно подшивать
      </h2>
      <p className="mt-7 max-w-xl text-base leading-relaxed text-muted">
        Одна модель — несколько ростов. Мы отшиваем длину заранее, чтобы
        классические брюки садились сразу, без ателье и подгонки.
      </p>
    </div>
  </section>
)

export default Editorial
