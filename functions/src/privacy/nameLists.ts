/**
 * Elenchi di nomi propri e cognomi usati dal rilevamento euristico dei nomi di persona.
 *
 * - FIRST_NAMES: nomi propri frequenti in Italia (ISTAT) più i nomi stranieri più diffusi tra i residenti.
 * - SURNAMES: cognomi italiani più frequenti.
 * - AMBIGUOUS_NAME_WORDS: nomi/cognomi che sono anche parole comuni, città o marchi ("Rosa", "Costa",
 *   "Messina"): valgono solo accanto a un altro nome ("Rosa Russo"), mai da soli o in minuscolo.
 */

const words = (list: string) => list.split(/\s+/).filter(Boolean);

export const FIRST_NAMES = new Set(
  words(`
    adriana adriano agata agostino alberto alba alessandra alessandro alessia alessio alfonso alfredo alice
    amedeo andrea angela angelo anna annalisa antonella antonietta antonino antonio arianna armando
    arturo attilio aurelio barbara beatrice benedetta bruno calogero camilla carla carlo carmela carmelo carmine
    caterina cesare chiara claudia claudio concetta corrado cosimo cristian cristiana cristina cristiano damiano
    daniela daniele dario davide debora diego domenico donatella donato edoardo elena eleonora elisa elisabetta
    emanuela emanuele emilio enrico enzo erika ernesto ettore eugenio fabiana fabio fabrizio federica federico
    filippo filomena flavio francesca francesco gabriele gabriella gaetano giacomo gianluca gianni giorgia giorgio
    giovanna giovanni girolamo giulia giuliana giuliano giulio giuseppa giuseppe giuseppina graziella guido
    ignazio ilaria immacolata irene ivan ivana jessica laura leonardo letizia liliana lino lisa loredana lorena
    lorenzo luana luca lucia luciana luciano lucio luigi luisa manuel manuela marcello marco margherita maria
    mariagrazia mariangela marianna mario marisa martina massimiliano massimo matilde matteo mattia maurizio
    mauro michela michele milena mirko monica nadia nicola nicoletta nicolò noemi nunzia nunzio orazio ornella
    pamela paola paolo pasquale patrizia patrizio piera piero pietro raffaele raffaella renato riccardo rita
    roberta roberto rocco romano rosalba rosanna rosaria rosario rossella ruggero sabrina salvatore samuele
    sandra sandro sara saverio sebastiano serena sergio silvana silvia silvio simona simone sofia stefania
    stefano teresa tiziana tiziano tommaso ugo umberto valentina valentino valeria valerio vanessa veronica
    vincenza vincenzo virginia vito vittorio walter
    achille ada adele agnese alda aldo alfio amalia ambra anastasia angelica angelina annamaria
    antonia assunta aurora brunella carolina cecilia cinzia clara clelia dalila
    dante denis denise dina dino edda egidio elio eliana elvira emma enrica erica ermanno ester
    eva fausto fernanda fernando ferdinando fiorella flavia franca franco gemma gerardo giada
    gianfranco giancarlo gianluigi gianmarco gianpaolo gianpiero gilda gino gioele giordano grazia
    graziano greta gregorio ida ileana ines iolanda isabella lara lea lidia livia
    loredano lucrezia ludovica maddalena mafalda manlio mara marcella mariano marilena mariella
    mariarosa marta melissa miriam mirella morena nando natalia nicolas nina
    nino oreste orietta ottavio pierluigi pierpaolo pino quirino rachele raimondo rebecca
    renata riccarda rino rolando romina rosetta rossana ruben sabina samuel
    sebastiana selene severino silvano sonia susanna tamara tecla teodoro tina
    tullio valter vania viviana yuri zaira
    addolorata albina alfonsina alma amelia anselmo annunziata antonello arcangelo arnaldo augusto
    baldassare benito biagio bianca bruna caio camillo carlotta celeste cesira ciro clemente cleto
    cristoforo dalia damiana daria delia demetrio diana dora duilio elda elsa emiliano emilia
    enea erminia ermes ernesta eros ezio fabiola fedele felice felicia fiorenzo flora floriana
    fortunata fortunato fulvio gaspare gelsomina gennaro germana giacinto gianmaria gina ginevra
    gioacchino giosuè giuditta goffredo guglielmo igor ilenia innocenzo iole isidoro italo lamberto
    leandro leda leone leopoldo liberato libero liborio licia lina linda loris luana lucilla
    marcella marino marzia matilde michelangelo michelina mirco moreno natale nazario nella nerina
    nevio nicolina norma olga olimpia oriana osvaldo palma pasqualina patrick pellegrino pia piergiorgio
    pierino priscilla raffaello regina remo riccardo rina roberto rodolfo romeo romolo rosina rossano
    sabatino santina santino saturnino serafina serafino sesto silvestro simonetta stella sveva tazio
    teresio tito tobia tommasa tonino ubaldo ulisse umberta urbano vanda vera veronica viola virgilio
    vitale vittoria vittorino wanda zeno rosa rosalia rosaria carmen
    ahmed ali amir hassan hussein karim khalid mohamed mohammed mohammad mustafa omar rachid said youssef
    yassine fatima aisha amina khadija leila nour salma samira yasmine zahra
    andrei alexandru ion ionut mihai florin vasile cristian adrian bogdan dumitru gheorghe nicolae
    ana anca ioana elena mihaela gabriela andreea alina oana raluca irina natalia oksana olena svetlana tatiana
    yulia ivan sergei vladimir dmitri oleksandr mykola volodymyr
    john james michael david robert william thomas richard joseph charles george paul mark kevin brian
    steven jason daniel christopher peter alex alexander jack harry oliver liam noah ethan
    mary jennifer linda elizabeth susan sarah emily jessica ashley nicole laura emma olivia sophia chloe
    jean pierre jacques michel philippe françois nicolas julien marie sophie isabelle nathalie camille
    hans klaus jürgen wolfgang stefan thomas andreas markus matthias sebastian lukas
    josé juan carlos luis miguel javier jorge pedro manuel antonio francisco carmen lucía
    wei li ming hua jun yan lin hong
    rajesh singh kumar priya amit
    xhevdet arben besnik ermal gentian ilir sokol ardit elona erjona
  `)
);

export const SURNAMES = new Set(
  words(`
    rossi russo ferrari esposito bianchi romano colombo ricci marino greco bruno gallo conti costa giordano
    mancini rizzo lombardi moretti barbieri fontana santoro mariani rinaldi caruso ferrara galli martini leone
    longo gentile martinelli vitale lombardo serra coppola marchetti parisi villa conte ferraro ferri fabbri
    bianco marini grasso valentini messina sala gatti pellegrini palumbo sanna farina rizzi monti cattaneo
    morelli amato silvestri mazza testa grassi pellegrino carbone giuliani benedetti barone rossetti caputo
    montanari guerra palmieri bernardi martino fiore ferretti bellini basile riva donati piras vitali
    battaglia sartori neri costantini milani pagano ruggiero sorrentino orlando damico negri mazzoni
    fumagalli mancuso marchi bassi bernardini bertolini bettini bianchini bonetti borghi brambilla brunetti
    bucci buzzi cappelli carli caselli castelli cavallo cerutti cirillo colonna corsi cristiani
    fadda fiorini florio franchi fusco gargiulo giacomelli giorgi giuliano grimaldi guarino guidi iacono
    iannone iovine landi lanza leonardi locatelli lucchesi lupo maggi magri manzoni marchese marra marras
    marzano masi mattei melis meloni merlo micheli mocci moro mura musso napolitano nardi nicoletti noto
    olivieri orsini pace pagani palma parisi pastore pepe perrone piccolo pinna pizzi poli porcu puglisi
    raimondi riccardi rocca rocchi romeo rosati rota ruggieri salvi santini santangelo santucci scotti
    serafini sergi spina stella tedesco tosi tozzi valente venturi verdi vianello zanetti zanella zanoni
    zito catalano ciccone colella cozzi esposito ferrante fiorentino forte fortunato galasso garofalo
    giannini giovannini grieco guida iorio lorusso marchesi mariotti mattioli mazzola mele miceli
    montalto mosca murgia nanni natale oliva palladino paolini parente perri piazza pirozzi pugliese
    quaranta salvati sannino scarpa sciarra silvestro sodano tarantino toscano trevisan vinci volpe
    baldini battisti benetti bertoni biondi bonfanti borrelli bruni calabrese campana capuano carta
    cassano castellano cavallaro cecchi cocco cuomo melchiorre pasquali abate abbate accardi acquaviva
    adamo agostini albanese alberti alessi allegri alongi altieri amatucci ambrosini ambrosio amendola
    angeli angelini annunziata antonelli arena argento armenia arrigoni avallone baldi balestra bandini
    barbato barbera barberi bardi baroni bartoli bartolini basso battistini belli bellomo belotti
    benvenuti berardi bergamini berti bertolucci biagi biagini bianco biondo bonanno bonelli bonomi
    bordoni borelli borsellino boschi bosco bottaro bova bozzi bracco brancato bresciani brizzi bruno
    buonocore cacciatore caiazzo calabrò caldarelli calò camilli campanella campo cantoni capasso
    capelli capozzi cappello caprio caramia carbonara cardinale cardone carella carlini carnevale
    carosi carrara casagrande casale casella castaldi castelli castiglione cataldo catania cattani
    cavalli cecere celentano ceccarelli centofanti cerri cesari chiesa cianci ciampi cicero cimino
    cioffi cipriani cirillo citro clemente coco colangelo colli colucci comito conforti coppa corradi
    corrado corti cosentino costanzo crescenzi criscuolo croce cucinotta cuccia cusumano d'agostino
    d'alessandro d'ambrosio d'amico d'angelo d'anna d'antonio d'urso d'onofrio
   
    dini donadio donato
    esposti fabbrini fabiani falcone fantini farinelli fasano fava federici felici ferrando ferrero
    ferrini fiorentini fiorillo foti franceschi franco frigerio fumagalli gabrielli gagliardi galante
    galletti gallina gallo gambino garbo gasparini gatto gemelli gentili germani ghezzi ghirardi
    giacobbe giannelli gianni giglio gioia giordani giorgetti giovannelli girardi giusti gobbi gorini
    granata grandi greco grillo guarnieri guerrieri guerrini iacobelli iannelli iannuzzi ianni impellizzeri
    ingrassia innocenti lagana lamberti lanzi lauria lazzari lentini leonetti liguori lisi
    loiacono lombardini longhi lucarelli lucchetti luciani lunardi maffei
    magnani maiorano malizia mancinelli mangano manfredi manna mantovani manzi marcelli marchi marcone
    marconi mari mariano marinelli marinucci marotta martelli martinez martucci marzullo mascolo massa
    massari mastrangelo mastroianni mauri mazzei mazzotta medici melchiorri meli mengoni merli messineo
    miglio migliorini milano minelli minervini miotto mirabella misuraca molinari mollica monaco montagna
    montanaro monteleone morabito morganti mori morra mosca mottola muratori muscolino musumeci napoli
    nardini nava nicolosi nobili nuzzo oddo olivi onorato orrù ottaviani paganini pagliaro palazzo
    palermo palladino pancaldi panico pantaleo paolucci pappalardo parrinello parodi pascale pasini
    pasquini passaro pastorino patanè pavan pedrazzini pellegrinelli pelosi penna perini perna perrotta
    pesce petrone petrucci piazza piccinini piccione pierini pieri pietrini pinto pisani pistone pittau
    pizzo pizzuti polito pozzi prato preziosi primavera proietti pucci puglia puleo quaglia radaelli
    raffaelli randazzo ranieri rapisarda ravelli re ricciardi riccio righi rinaldo riva rizzuto robusti
    rocco romanelli romani romagnoli ronchi rosa rosi rosso rotondo ruberto ruggeri ruocco
    rusconi russi russotto sabatini sacchi sacco salemi salerno salvatori salvini sanfilippo sangiorgi
    santarelli santi santoni saponaro sardo sartor saviano savino scala scalia scaglione scarano
    schiavone sciortino scognamiglio scuderi sebastiani sena serafino sereni serio sessa sette sgrò
    signorelli simonetti simoni sinopoli soldati sorace spada spadaro spagnolo sperandio spinelli
    stefanelli stefani sturniolo tagliaferri talarico tamburini tarantini tassi tedeschi terranova
    testa tirelli tomasello tommasi tonelli torre torres toscani totaro trapani traversa trentin
    tricarico trombetta tucci tumminello turco ungaro urso vaccaro valenti valentino valle vallone
    vanni vecchi vella venezia ventura vergani verri vespa vicari vigano villani vinciguerra virgili
    visconti vitiello viviani volpi zaccaria zaccaro zamboni zanardi zanetti zappalà zara zecchini
    zerbini ziliotto zucca zuccaro
    biagi gozzini fornero cartabia
  `)
);

/**
 * Nomi o cognomi che sono anche parole comuni, città, regioni, marchi, titoli o nomi di leggi:
 * da soli (o in minuscolo) non bastano per riconoscere una persona.
 */
export const AMBIGUOUS_NAME_WORDS = new Set(
  words(`
    rosa vera serena chiara bianca viola gioia stella speranza fortuna natale celeste aurora fiore alba
    diana palma regina santa santo pia flora dora lea gemma ambra fedele felice libero remo norma linda
    vita giada viola carmen grazia italo sesto leone vitale romano marino franco bruno costa villa
    sala testa pace riva serra porta conte barone guerra carbone farina monti monte mazza grasso grassi bianco
    rosso rossa neri verdi greco gallo lupo moro leone volpe gatto cavallo vacca mosca pesce mele oliva
    manna fiore stella spina scarpa zucca sacco carta campana piazza palazzo prato torre valle colonna
    croce chiesa bosco campo monaco re pepe noto forte guida parente piccolo pastore pagano pugliese
    tedesco toscano calabrese catalano fiorentino lombardo tarantino milano napoli palermo messina
    salerno trapani venezia catania puglia ferrara massa scala sette quaranta penna granata prato
    primavera gioia giusti grandi gentile gentili martini ferrero cardinale abate medici
    santi grande nobili innocenti felici dini bello belli gemelli cacciatore
    turco sardo moro biondo biondi bruni rocca riva marino valente fedele clemente costanzo urbano
    fornero cartabia biagi gozzini pinto
  `)
);
