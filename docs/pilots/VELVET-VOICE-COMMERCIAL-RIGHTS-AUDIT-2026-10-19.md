# Velvet Passport — Audit droits vocaux — 2026-10-19

## Objectif
Évaluer les quatre voix sélectionnées artistiquement pour les parcours commerciaux Velvet Passport. Ce document est un registre de conformité, **pas** un avis juridique ou une autorisation finale.

## Moteur
- Chatterbox Multilingual V3 (Resemble AI) — licence MIT selon le dépôt et la fiche officielle : usage commercial du logiciel autorisé sous conditions MIT.
- La licence du logiciel **ne cède pas** les droits de la personne dont une voix est reproduite.
- Sources: https://huggingface.co/ResembleAI/chatterbox ; https://www.resemble.ai/products/text-to-speech

## Références
| Profil | Référence | Origine | Licence corpus | Audit clonage vocal |
|---|---|---|---|---|
| FR homme | voix native Chatterbox V3 (aucun audio_prompt_path explicite) | modèle Chatterbox | MIT logiciel | vérifier conditions de modèle/sortie; pas de locuteur de référence tiers explicitement fourni |
| FR femme | candidate 02 / 10177_10625_000134-0003_enhanced.wav | kyutai/tts-voices, CML-TTS/fr | CC BY 4.0 | HOLD: identité/autorisation de clonage et publicité/voix non établies |
| EN homme | p232_023_enhanced.wav | kyutai/tts-voices, VCTK | CC BY 4.0 | HOLD: autorisation voix synthétique commerciale non établie |
| EN femme | p239_023_enhanced.wav | kyutai/tts-voices, VCTK | CC BY 4.0 | HOLD: autorisation voix synthétique commerciale non établie |

## Sources de droits vérifiées
- Kyutai identifie VCTK et CML-TTS/fr en CC BY 4.0: https://huggingface.co/kyutai/tts-voices
- CML-TTS source primaire: https://github.com/freds0/CML-TTS-Dataset ; https://www.openslr.org/146/
- Creative Commons rappelle que ses licences ne règlent pas nécessairement les droits de la personnalité/publicité de tiers: https://creativecommons.org/faq/
- Conditions de Resemble AI concernant droits et consentement (service hébergé; ne pas présumer qu'elles gouvernent à l'identique chaque déploiement local): https://www.resemble.ai/terms-of-service ; https://www.resemble.ai/products/voice-creation

## Obligations et portes
1. Fournir attribution CC BY: source exacte, auteur/crédit disponible, lien de licence, modifications/nettoyage, avis de non-endorsement.
2. Obtenir une confirmation documentée que la **reproduction synthétique commerciale d'une voix identifiable** est autorisée pour les trois références tierces, ou les remplacer par des prises vocales avec consentement explicite incluant TTS, clonage, diffusion payante, langues, territoires, durée et révocation.
3. Avant publication, valider conditions applicables de Resemble/Chatterbox et exam juridique adapté aux marchés de distribution.
4. Ne pas considérer l'approbation artistique comme clearance des droits.

## Statut opérationnel
- Audit licences documentées: PASS (identification préliminaire)
- Droit d'utilisation commerciale du logiciel Chatterbox: PASS sous MIT
- Droit commercial sur les trois voix clonées: **HOLD**
- Publication commerciale avec ces trois voix: **NON AUTORISÉE à ce stade**
- Préparation technique, QA, production d'essais internes: possible en gardant le statut HOLD
- Aucun scénario/master LOCK modifié.

## Plan de clôture
- Demander au détenteur du corpus les preuves de consentement pour les références spécifiques et l'autorisation de synthèse commerciale.
- Si indisponible, obtenir des références avec consentement explicite ou une offre de voix sous contrat adapté; refaire uniquement l'audition des références concernées, sans refaire les scénarios.
