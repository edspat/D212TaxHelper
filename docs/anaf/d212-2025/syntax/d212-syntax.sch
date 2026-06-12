
<pattern xmlns="http://purl.oclc.org/dsdl/schematron" id="syntax">
    <!-- versiunea v1.0.0 din 23.12.2025 conform cu d212_documentatieTehnica_v1.0.0_23122025.xls --> 
    <title>D212 – Syntax validation</title>
    <!-- RULE 1: element leaf complet gol (nici text, nici atribute) -->
    <rule context="//*[not(*)]">
        
        <!-- numele elementului curent (fara prefix) -->
        <let name="elemName" value="local-name(.)"/>
        
        <!-- descrierea elementului curent din XSD -->
        <let name="elemDesc"
            value="$schema//xs:element[@name = $elemName]
            /xs:annotation/xs:documentation[1]"/>
        
        <assert test="@* or normalize-space(.) != ''"
            flag="fatal"
            id="SN-D212-001">
            [SN-D212-001] Elementul <value-of select="$elemName"/>
            ("<value-of select="
                if (normalize-space($elemDesc) != '')
                then $elemDesc
                else $elemName
                "/>")
            este prezent, dar nu contine nicio valoare
            (nu are nici atribute, nici text).
        </assert>
    </rule>
    
    <!-- RULE 2: atribute goale, cu descriere + nume atribut -->
    <rule context="//@*">
        
        <let name="attName" value="name(.)"/>
        
        <let name="desc"
            value="$schema//xs:attribute[@name = $attName]
            /xs:annotation/xs:documentation[1]"/>
        
        <assert test="normalize-space(string(.)) != ''"
            flag="fatal"
            id="SN-D212-002" >
            [SN-D212-002"] Atributul <value-of select="$attName"/>
            ("<value-of select="
                if (normalize-space($desc) != '')
                then $desc
                else $attName
                "/>")
            al elementului <value-of select="name(..)"/>
            are valoare vida sau doar spatii.
        </assert>
    </rule>
    
    </pattern>
    