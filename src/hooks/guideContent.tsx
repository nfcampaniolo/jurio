import React from 'react';
import Introduzione from '@/components/Guida/Introduzione';
import InterfacceNavigazione from '@/components/Guida/InterfacceNavigazione';
import RicercaSemantica from '@/components/Guida/RicercaSemantica';
import ConsulenteLegale from '@/components/Guida/ConsulenteLegale';
import AnalisiDocumenti from '@/components/Guida/AnalisiDocumenti';
import Accesso from '@/components/Guida/Accesso';
import ProvaGratuita from '@/components/Guida/ProvaGratuita';
import GestionePiano from '@/components/Guida/GestionePiano';
import ModificaProfilo from '@/components/Guida/ModificaProfilo';
import PianiLicenze from '@/components/Guida/PianiLicenze';
import AssistenzaSupporto from '@/components/Guida/AssistenzaSupporto';
import AggiornamentoForzato from '@/components/Guida/AggiornamentoForzato';
import GestioneTeam from '@/components/Guida/GestioneTeam';
import Cassazione from '@/components/Guida/Cassazione';
import ConsiglioStato from '@/components/Guida/ConsiglioStato';
import CorteCostituzionale from '@/components/Guida/CorteCostituzionale';
import QuoteUtilizzo from '@/components/Guida/QuoteUtilizzo';
import ConfigurazioneLeChat from '@/components/Guida/ConfigurazioneLeChat';

export const guideContent: Record<string, React.ReactNode> = {
  "introduzione": <Introduzione />,
  "interfacce": <InterfacceNavigazione />,
  "ricerca-semantica": <RicercaSemantica />,
  "consulente-legale": <ConsulenteLegale />,
  "analisi-documenti": <AnalisiDocumenti />,
  "accesso": <Accesso />,
  "prova-gratuita": <ProvaGratuita />,
  "gestione-piano": <GestionePiano />,
  "preferenze": <ModificaProfilo />,
  "piani": <PianiLicenze />,
  "assistenza": <AssistenzaSupporto />,
  "aggiornamento-forzato": <AggiornamentoForzato />,
  "gestione-team": <GestioneTeam />,
  "cassazione": <Cassazione />,
  "consiglio-di-stato": <ConsiglioStato />,
  "corte-costituzionale": <CorteCostituzionale />,
  "quote": <QuoteUtilizzo />,
  "mcp-vibe": <ConfigurazioneLeChat />,
};