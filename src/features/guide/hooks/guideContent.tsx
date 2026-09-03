import React from 'react';
import Introduzione from '@/features/guide/components/Introduzione';
import InterfacceNavigazione from '@/features/guide/components/InterfacceNavigazione';
import RicercaSemantica from '@/features/guide/components/RicercaSemantica';
import ConsulenteLegale from '@/features/guide/components/ConsulenteLegale';
import AnalisiDocumenti from '@/features/guide/components/AnalisiDocumenti';
import Accesso from '@/features/guide/components/Accesso';
import ProvaGratuita from '@/features/guide/components/ProvaGratuita';
import GestionePiano from '@/features/guide/components/GestionePiano';
import ModificaProfilo from '@/features/guide/components/ModificaProfilo';
import PianiLicenze from '@/features/guide/components/PianiLicenze';
import AssistenzaSupporto from '@/features/guide/components/AssistenzaSupporto';
import AggiornamentoForzato from '@/features/guide/components/AggiornamentoForzato';
import GestioneTeam from '@/features/guide/components/GestioneTeam';
import Cassazione from '@/features/guide/components/Cassazione';
import ConsiglioStato from '@/features/guide/components/ConsiglioStato';
import CorteCostituzionale from '@/features/guide/components/CorteCostituzionale';
import QuoteUtilizzo from '@/features/guide/components/QuoteUtilizzo';
import ConfigurazioneLeChat from '@/features/guide/components/ConfigurazioneLeChat';

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