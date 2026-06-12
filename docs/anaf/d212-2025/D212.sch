<?xml version="1.0" encoding="UTF-8"?>
<!-- 
    versiunea v1.0.1 din 05.01.2026 conform cu d212_documentatieTehnica_v1.0.1_05012026.xls
    versiunea v1.0.0 din 23.12.2025 conform cu d212_documentatieTehnica_v1.0.0_23122025.xls 
--> 
<schema xmlns="http://purl.oclc.org/dsdl/schematron"
    xmlns:d212="mfp:anaf:dgti:d212:declaratie:v11"
    queryBinding="xslt2">
    
    <ns prefix="d212" uri="mfp:anaf:dgti:d212:declaratie:v11"/>
    <!-- namespace-ul pentru XSD -->
    <ns prefix="xs"   uri="http://www.w3.org/2001/XMLSchema"/> 
    
    
    <!-- Incarcam XSD-ul documentat (cale relativa fata de driver TEST)
    <let name="schema"
        value="doc('d212_schema.xsd')"/> -->
    <!-- load external nomenclator CAEN (file in same folder as this schematron)
    <let name="caen" 
        value="doc('nomenclator_caen.xml')"/> -->
    
    <!-- Incarcam XSD-ul documentat si nomenclator CAEN (cale relativa fata de driver PRODUCTIE) -->
    <let name="schema"
        value="doc('file:///validare/D212/d212_schema.xsd')"/>
     <let name="caen" 
        value="doc('file:///validare/D212/nomenclator_caen.xml')"/>
    
    <phase id="syntax_phase">
        <active pattern="syntax"/>
    </phase>
    
    <phase id="codes_phase">
        <active pattern="codes"/>
    </phase>
    
    <phase id="business_phase">
        <active pattern="business"/> 
        <active pattern="business-2"/>
        <active pattern="business-3"/>
        <active pattern="business-4"/>
    </phase>
    

    
    <include href="syntax/d212-syntax.sch"/>
    <include href="codes/d212-codes.sch"/>
    <include href="business/d212-business.sch"/>
    <include href="business/d212-business-2.sch"/>
    <include href="business/d212-business-3.sch"/>
    <include href="business/d212-business-4.sch"/>
</schema>

